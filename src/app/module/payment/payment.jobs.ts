import httpStatus from "http-status";
import {
	PaymentProvider,
	PaymentStatus,
	RegistrationStatus,
} from "../../../generated/prisma/enums";
import { queueEmail } from "../../jobs/email";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { bkashRequest } from "../../lib/bkash";
import { publishSeatEvent } from "../../lib/seatEvents";
import { AppError } from "../../utils/AppError";
import { minimumPaymentOf } from "../../utils/registrationTotals";
import { formatDhaka } from "../../utils/time";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import { createNotificationsIntoDB } from "../notification/notification.service";
import { paymentService } from "./payment.service";

const DAY = 86400000;

// Hourly: discard ACTIVE, UNPAID, billed registrations past their deadline.
export const discardUnpaidRegistrations = async () => {
	const due = await prisma.semesterRegistration.findMany({
		where: {
			status: RegistrationStatus.ACTIVE,
			paymentStatus: "UNPAID",
			totalFee: { gt: 0 },
			paymentDeadline: { lt: new Date() },
		},
		select: { id: true },
	});
	let discarded = 0;
	for (const { id } of due) {
		const result = await prisma.$transaction(async (tx) => {
			const updated = await tx.semesterRegistration.updateMany({
				where: {
					id,
					status: RegistrationStatus.ACTIVE,
					paymentStatus: "UNPAID",
				},
				data: { status: RegistrationStatus.DISCARDED, discardedAt: new Date() },
			});
			if (updated.count === 0) return null;
			const registration = await tx.semesterRegistration.findUniqueOrThrow({
				where: { id },
				include: {
					student: { select: { name: true, email: true, userId: true } },
					semester: { select: { id: true, name: true } },
				},
			});
			const enrollments = await tx.enrollment.findMany({
				where: { registrationId: id, status: "ENROLLED" },
				select: { id: true, sectionId: true },
			});
			await tx.enrollment.updateMany({
				where: { id: { in: enrollments.map((row) => row.id) } },
				data: { status: "DISCARDED" },
			});
			const perSection = new Map<string, number>();
			for (const row of enrollments)
				perSection.set(row.sectionId, (perSection.get(row.sectionId) ?? 0) + 1);
			const seats: {
				sectionId: string;
				enrolledCount: number;
				capacity: number;
			}[] = [];
			for (const [sectionId, count] of [...perSection].sort(([a], [b]) =>
				a.localeCompare(b),
			)) {
				await tx.section.updateMany({
					where: { id: sectionId, enrolledCount: { gte: count } },
					data: { enrolledCount: { decrement: count } },
				});
				const section = await tx.section.findUniqueOrThrow({
					where: { id: sectionId },
					select: { id: true, enrolledCount: true, capacity: true },
				});
				seats.push({
					sectionId,
					enrolledCount: section.enrolledCount,
					capacity: section.capacity,
				});
			}
			await createNotificationsIntoDB(tx, [
				{
					userId: registration.student.userId,
					type: "DISCARDED",
					title: "Registration discarded",
					message: `Your ${registration.semester.name} registration was discarded because 40% wasn't paid in time.`,
				},
			]);
			await createAuditLogIntoDB(tx, {
				actorId: null,
				action: "REGISTRATION_DISCARDED",
				entity: "SemesterRegistration",
				entityId: id,
				before: { status: "ACTIVE", paymentStatus: "UNPAID" },
				after: { status: "DISCARDED", enrollments: enrollments.length },
				reason: "Minimum payment not made before the deadline",
			});
			return { registration, seats };
		});
		if (!result) continue;
		discarded += 1;
		const { registration, seats } = result;
		try {
			await queueEmail({
				to: registration.student.email,
				subject: "Your registration was discarded",
				templateName: "registration-discarded",
				templateData: {
					name: registration.student.name,
					semester: registration.semester.name,
					deadline: formatDhaka(registration.paymentDeadline),
				},
			});
		} catch (error) {
			logger.error({ err: error }, "Discard email could not be queued");
		}
		for (const seat of seats)
			await publishSeatEvent(registration.semester.id, seat).catch(() =>
				logger.error("Seat event could not be published"),
			);
	}
	return { discarded };
};

// Daily at 10:00: remind students whose deadline is 5, 2 or 1 days away.
export const sendPaymentReminders = async () => {
	const now = Date.now();
	const registrations = await prisma.semesterRegistration.findMany({
		where: {
			status: RegistrationStatus.ACTIVE,
			paymentStatus: "UNPAID",
			totalFee: { gt: 0 },
			paymentDeadline: { gt: new Date(now), lte: new Date(now + 5 * DAY) },
		},
		include: {
			student: { select: { name: true, email: true } },
			semester: { select: { name: true, minPaymentPercent: true } },
		},
	});
	let sent = 0;
	for (const registration of registrations) {
		const daysLeft = Math.ceil(
			(registration.paymentDeadline.getTime() - now) / DAY,
		);
		if (![5, 2, 1].includes(daysLeft)) continue;
		try {
			await queueEmail({
				to: registration.student.email,
				subject: `Payment reminder: ${daysLeft} day(s) left`,
				templateName: "payment-reminder",
				templateData: {
					name: registration.student.name,
					semester: registration.semester.name,
					deadline: formatDhaka(registration.paymentDeadline),
					daysLeft,
					minimum: minimumPaymentOf(
						registration.totalFee,
						registration.semester.minPaymentPercent,
					).toString(),
				},
			});
			sent += 1;
		} catch (error) {
			logger.error({ err: error }, "Payment reminder could not be queued");
		}
	}
	return { sent };
};

// Every 15 minutes: settle PENDING payments older than 30 minutes with bKash.
export const settleAbandonedPayments = async () => {
	const stale = await prisma.payment.findMany({
		where: {
			status: PaymentStatus.PENDING,
			createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
		},
		select: {
			id: true,
			registrationId: true,
			providerTransactionId: true,
		},
	});
	let completed = 0;
	for (const payment of stale) {
		try {
			const base = {
				paymentId: payment.id,
				registrationId: payment.registrationId,
				provider: PaymentProvider.BKASH,
			};
			if (!payment.providerTransactionId) {
				await prisma.payment.updateMany({
					where: { id: payment.id, status: PaymentStatus.PENDING },
					data: { status: PaymentStatus.FAILED },
				});
				continue;
			}
			const remote = await bkashRequest("/tokenized/checkout/payment/status", {
				paymentID: payment.providerTransactionId,
			});
			if (
				remote.statusCode === "0000" &&
				remote.transactionStatus === "Completed"
			) {
				const paid = {
					...base,
					providerTransactionId: payment.providerTransactionId,
					amount: remote.amount as string,
					currency: remote.currency as string,
				};
				try {
					await paymentService.completePaymentIntoDB(paid);
				} catch (error) {
					if (
						!(error instanceof AppError) ||
						error.statusCode !== httpStatus.CONFLICT
					)
						throw error;
					await paymentService.refundCancelledRegistrationPaymentIntoDB(paid);
				}
				completed += 1;
			} else {
				await paymentService.closePendingPaymentIntoDB({
					...base,
					providerTransactionId: payment.providerTransactionId,
					status: PaymentStatus.FAILED,
				});
			}
		} catch (error) {
			logger.error({ err: error }, "Abandoned payment could not be settled");
		}
	}
	return { checked: stale.length, completed };
};
