import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
	PaymentProvider,
	PaymentStatus,
	RegistrationStatus,
	SemesterPhase,
} from "../../../generated/prisma/enums";
import { queueEmail } from "../../jobs/email";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { generatePdf } from "../../utils/generatePdf";
import {
	minimumPaymentOf,
	paymentStatusOf,
} from "../../utils/registrationTotals";
import { formatDhaka } from "../../utils/time";
import type {
	IAdminPaymentQuery,
	ICheckoutResult,
	IClosePayment,
	ICompletePayment,
	ICreatePayment,
} from "./payment.interface";
import { getPaymentProvider } from "./providers/paymentProvider.factory";

const taka = (value: Prisma.Decimal) =>
	Number(value.toFixed(2)).toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});

const createPaymentIntoDB = async (userId: string, payload: ICreatePayment) => {
	const student = await prisma.student.findUnique({
		where: { userId },
		select: { id: true },
	});
	const semester = await prisma.semester.findFirst({
		where: { phase: { not: SemesterPhase.CLOSED } },
	});
	if (!student || !semester)
		throw new AppError(httpStatus.NOT_FOUND, "Registration not found");
	const registration = await prisma.semesterRegistration.findUnique({
		where: {
			unique_student_semester: {
				studentId: student.id,
				semesterId: semester.id,
			},
		},
		include: { student: { select: { email: true } } },
	});
	if (!registration)
		throw new AppError(httpStatus.NOT_FOUND, "Registration not found");
	if (
		semester.phase !== SemesterPhase.REGISTRATION &&
		semester.phase !== SemesterPhase.CLASSES
	)
		throw new AppError(
			httpStatus.CONFLICT,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	if (registration.status !== RegistrationStatus.ACTIVE)
		throw new AppError(httpStatus.CONFLICT, "Your registration was discarded", {
			code: "REGISTRATION_DISCARDED",
		});
	if (registration.paymentStatus === "FULLY_PAID")
		throw new AppError(httpStatus.CONFLICT, "Nothing is left to pay");
	if (registration.totalFee.lte(0))
		throw new AppError(httpStatus.CONFLICT, "You have nothing to pay");

	const remaining = registration.totalFee.minus(registration.paidAmount);
	const minimum = minimumPaymentOf(
		registration.totalFee,
		semester.minPaymentPercent,
	);
	const smallest = registration.paidAmount.lt(minimum)
		? Prisma.Decimal.min(minimum.minus(registration.paidAmount), remaining)
		: Prisma.Decimal.min(new Prisma.Decimal(1), remaining);
	if (payload.amount.lt(smallest) || payload.amount.gt(remaining))
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Minimum payment is ৳${taka(smallest)}; maximum is ৳${taka(remaining)}`,
			{
				code: "PAYMENT_AMOUNT_INVALID",
				minimum: smallest.toFixed(2),
				maximum: remaining.toFixed(2),
			},
		);

	const selectedProvider = payload.provider ?? PaymentProvider.BKASH;
	const provider = getPaymentProvider(selectedProvider);
	const inProgress = () =>
		new AppError(
			httpStatus.CONFLICT,
			"You already have a payment in progress",
			{
				code: "PAYMENT_IN_PROGRESS",
			},
		);
	let payment: Awaited<ReturnType<typeof prisma.payment.create>>;
	try {
		payment = await prisma.$transaction(
			async (transaction) => {
				const pending = await transaction.payment.findFirst({
					where: {
						registrationId: registration.id,
						status: PaymentStatus.PENDING,
					},
					select: { id: true },
				});
				if (pending) throw inProgress();
				return transaction.payment.create({
					data: {
						registrationId: registration.id,
						amount: payload.amount,
						provider: selectedProvider,
						status: PaymentStatus.PENDING,
					},
				});
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2034"
		)
			throw inProgress();
		throw error;
	}

	let checkout: ICheckoutResult;
	try {
		checkout = await provider.createCheckoutSession({
			registrationId: registration.id,
			paymentId: payment.id,
			amount: payload.amount.toFixed(2),
			currency: "bdt",
			serviceTitle: `Semester fee — ${semester.name}`,
			customerEmail: registration.student.email,
		});
	} catch (error) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
		throw error;
	}
	await prisma.payment.update({
		where: { id: payment.id },
		data: { providerTransactionId: checkout.providerTransactionId },
	});
	return { paymentId: payment.id, checkoutUrl: checkout.checkoutUrl };
};

const queueReceipt = async (paymentId: string) => {
	try {
		const payment = await prisma.payment.findUniqueOrThrow({
			where: { id: paymentId },
			include: {
				registration: {
					include: {
						student: { select: { name: true, email: true } },
						semester: { select: { name: true } },
					},
				},
			},
		});
		const { registration } = payment;
		await queueEmail({
			to: registration.student.email,
			subject: "Payment receipt",
			templateName: "payment-receipt",
			templateData: {
				name: registration.student.name,
				semester: registration.semester.name,
				amount: taka(payment.amount),
				transactionId: payment.transactionId,
				totalPaid: taka(registration.paidAmount),
				remaining: taka(registration.totalFee.minus(registration.paidAmount)),
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Receipt email could not be queued");
	}
};

const completePaymentIntoDB = async (payload: ICompletePayment) => {
	if (payload.currency.toLowerCase() !== "bdt")
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment currency does not match",
		);

	const { payment: result, changed } = await prisma.$transaction(
		async (transaction) => {
			const payment = await transaction.payment.findUnique({
				where: { id: payload.paymentId },
				select: {
					id: true,
					registrationId: true,
					provider: true,
					providerTransactionId: true,
					amount: true,
					status: true,
					registration: { select: { status: true } },
				},
			});
			if (
				!payment ||
				payment.registrationId !== payload.registrationId ||
				payment.provider !== payload.provider
			)
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Payment details do not match",
				);
			if (!payment.amount.equals(payload.amount))
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Payment amount does not match",
				);
			if (
				payment.providerTransactionId &&
				payment.providerTransactionId !== payload.providerTransactionId
			)
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Payment session does not match",
				);
			if (payment.status === PaymentStatus.COMPLETED)
				return {
					payment: await transaction.payment.findUniqueOrThrow({
						where: { id: payment.id },
					}),
					changed: false,
				};
			if (
				payment.status !== PaymentStatus.PENDING ||
				payment.registration.status !== RegistrationStatus.ACTIVE
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"This registration cannot be marked as paid",
				);

			const updatedPayment = await transaction.payment.updateMany({
				where: {
					id: payment.id,
					status: PaymentStatus.PENDING,
					OR: [
						{ providerTransactionId: null },
						{ providerTransactionId: payload.providerTransactionId },
					],
				},
				data: {
					status: PaymentStatus.COMPLETED,
					providerTransactionId: payload.providerTransactionId,
					paidAt: new Date(),
				},
			});
			if (updatedPayment.count === 0)
				throw new AppError(
					httpStatus.CONFLICT,
					"Payment status changed. Please try again",
				);

			// The guarded increment locks the registration row until commit.
			const bumped = await transaction.semesterRegistration.updateMany({
				where: {
					id: payment.registrationId,
					status: RegistrationStatus.ACTIVE,
				},
				data: { paidAmount: { increment: payment.amount } },
			});
			if (bumped.count === 0)
				throw new AppError(
					httpStatus.CONFLICT,
					"Registration status changed. Please try again",
				);
			const registration =
				await transaction.semesterRegistration.findUniqueOrThrow({
					where: { id: payment.registrationId },
					include: { semester: { select: { minPaymentPercent: true } } },
				});
			await transaction.semesterRegistration.update({
				where: { id: registration.id },
				data: {
					paymentStatus: paymentStatusOf(
						registration.totalFee,
						registration.paidAmount,
						registration.semester.minPaymentPercent,
					),
				},
			});
			return {
				payment: await transaction.payment.findUniqueOrThrow({
					where: { id: payment.id },
				}),
				changed: true,
			};
		},
	);
	if (changed) await queueReceipt(result.id);
	return result;
};

const closePendingPaymentIntoDB = async (payload: IClosePayment) => {
	if (
		payload.status !== PaymentStatus.FAILED &&
		payload.status !== PaymentStatus.CANCELLED
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment status");
	}

	const payment = await prisma.payment.findUnique({
		where: {
			id: payload.paymentId,
		},
		select: {
			id: true,
			registrationId: true,
			provider: true,
			providerTransactionId: true,
			status: true,
		},
	});

	if (
		!payment ||
		payment.registrationId !== payload.registrationId ||
		payment.provider !== payload.provider ||
		(payment.providerTransactionId &&
			payment.providerTransactionId !== payload.providerTransactionId)
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment details do not match");
	}

	if (payment.status !== PaymentStatus.PENDING) {
		return payment;
	}

	const updatedPayment = await prisma.payment.updateMany({
		where: {
			id: payment.id,
			status: PaymentStatus.PENDING,
			OR: [
				{ providerTransactionId: null },
				{ providerTransactionId: payload.providerTransactionId },
			],
		},
		data: {
			status: payload.status,
			providerTransactionId: payload.providerTransactionId,
		},
	});

	if (updatedPayment.count === 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Payment status changed. Please try again",
		);
	}

	return prisma.payment.findUniqueOrThrow({
		where: {
			id: payment.id,
		},
	});
};

const refundCancelledRegistrationPaymentIntoDB = async (
	payload: ICompletePayment,
) => {
	if (payload.currency.toLowerCase() !== "bdt") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment currency does not match",
		);
	}

	const payment = await prisma.payment.findUnique({
		where: {
			id: payload.paymentId,
		},
		select: {
			id: true,
			registrationId: true,
			provider: true,
			providerTransactionId: true,
			amount: true,
			status: true,
			paidAt: true,
			registration: {
				select: {
					status: true,
				},
			},
		},
	});

	if (
		!payment ||
		payment.registrationId !== payload.registrationId ||
		payment.provider !== payload.provider ||
		(payment.providerTransactionId &&
			payment.providerTransactionId !== payload.providerTransactionId)
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment details do not match");
	}

	if (!payment.amount.equals(payload.amount)) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment amount does not match");
	}

	if (payment.registration.status !== RegistrationStatus.DISCARDED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This registration has not been cancelled",
		);
	}

	if (
		payment.status === PaymentStatus.REFUND_PENDING ||
		payment.status === PaymentStatus.REFUNDED
	) {
		return prisma.payment.findUniqueOrThrow({
			where: {
				id: payment.id,
			},
		});
	}

	const provider = getPaymentProvider(payment.provider);

	const refund = await provider.refundPayment({
		paymentId: payment.id,
		providerTransactionId: payload.providerTransactionId,
	});

	const refundStatus =
		refund.status === "succeeded"
			? PaymentStatus.REFUNDED
			: refund.status === "failed" || refund.status === "canceled"
				? PaymentStatus.REFUND_FAILED
				: PaymentStatus.REFUND_PENDING;

	const updatedPayment = await prisma.payment.updateMany({
		where: {
			id: payment.id,
			registration: {
				status: RegistrationStatus.DISCARDED,
			},
			status: {
				in: [
					PaymentStatus.PENDING,
					PaymentStatus.COMPLETED,
					PaymentStatus.FAILED,
					PaymentStatus.CANCELLED,
				],
			},
			providerRefundId: null,
			OR: [
				{ providerTransactionId: null },
				{ providerTransactionId: payload.providerTransactionId },
			],
		},
		data: {
			status: refundStatus,
			providerTransactionId: payload.providerTransactionId,
			providerRefundId: refund.providerRefundId,
			paidAt: payment.paidAt ?? new Date(),
		},
	});

	if (updatedPayment.count === 0) {
		const currentPayment = await prisma.payment.findUniqueOrThrow({
			where: {
				id: payment.id,
			},
		});

		if (
			currentPayment.status === PaymentStatus.REFUND_PENDING ||
			currentPayment.status === PaymentStatus.REFUND_FAILED ||
			currentPayment.status === PaymentStatus.REFUNDED
		) {
			return currentPayment;
		}

		throw new AppError(
			httpStatus.CONFLICT,
			"Payment status changed. Please try again",
		);
	}

	return prisma.payment.findUniqueOrThrow({
		where: {
			id: payment.id,
		},
	});
};

const updateRefundStatusIntoDB = async (
	provider: PaymentProvider,
	providerRefundId: string,
	status: string | null,
): Promise<void> => {
	const refundStatus =
		status === "succeeded"
			? PaymentStatus.REFUNDED
			: status === "failed" || status === "canceled"
				? PaymentStatus.REFUND_FAILED
				: null;

	if (!refundStatus) {
		return;
	}

	const updatedPayment = await prisma.payment.updateMany({
		where: {
			provider,
			providerRefundId,
			status: {
				in: [
					PaymentStatus.REFUND_PENDING,
					PaymentStatus.REFUND_FAILED,
					PaymentStatus.REFUNDED,
				],
			},
		},
		data: {
			status: refundStatus,
		},
	});

	if (updatedPayment.count === 0) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Payment for this refund was not found",
		);
	}
};

const refundCancelledPaidRegistrationIntoDB = async (
	registrationId: string,
) => {
	const payment = await prisma.payment.findFirst({
		where: {
			registrationId,
			status: {
				in: [
					PaymentStatus.COMPLETED,
					PaymentStatus.REFUND_PENDING,
					PaymentStatus.REFUNDED,
				],
			},
		},
		select: {
			id: true,
			provider: true,
			providerTransactionId: true,
			amount: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	if (!payment?.providerTransactionId) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Paid registration payment was not found",
		);
	}

	return refundCancelledRegistrationPaymentIntoDB({
		paymentId: payment.id,
		registrationId,
		provider: payment.provider,
		providerTransactionId: payment.providerTransactionId,
		amount: payment.amount.toString(),
		currency: "bdt",
	});
};

const paymentSelect = {
	id: true,
	transactionId: true,
	providerTransactionId: true,
	registrationId: true,
	amount: true,
	method: true,
	provider: true,
	status: true,
	paidAt: true,
	createdAt: true,
	updatedAt: true,
	registration: {
		select: {
			status: true,
			paymentStatus: true,
			semester: { select: { name: true } },
		},
	},
} satisfies Prisma.PaymentSelect;

interface IViewer {
	id: string;
	role: string;
}

const getMyPaymentsFromDB = async (userId: string) =>
	prisma.payment.findMany({
		where: { registration: { student: { userId } } },
		select: paymentSelect,
		orderBy: { createdAt: "desc" },
	});

const getViewablePaymentFromDB = async (id: string, user: IViewer) => {
	const payment = await prisma.payment.findUnique({
		where: { id },
		include: {
			registration: {
				include: {
					student: { select: { userId: true, name: true, universityId: true } },
					semester: { select: { name: true } },
				},
			},
		},
	});
	if (!payment) throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	if (
		user.role === "STUDENT" &&
		payment.registration.student.userId !== user.id
	)
		throw new AppError(httpStatus.FORBIDDEN, "This is not your payment");
	return payment;
};

const getPaymentByIdFromDB = async (id: string, user: IViewer) => {
	const payment = await getViewablePaymentFromDB(id, user);
	return prisma.payment.findUniqueOrThrow({
		where: { id: payment.id },
		select: paymentSelect,
	});
};

const getReceiptPdfFromDB = async (id: string, user: IViewer) => {
	const payment = await getViewablePaymentFromDB(id, user);
	if (payment.status !== PaymentStatus.COMPLETED)
		throw new AppError(
			httpStatus.CONFLICT,
			"A receipt is only available for completed payments",
		);
	const { registration } = payment;
	return generatePdf((pdf) => {
		pdf.fontSize(20).text("Payment Receipt", { align: "center" }).moveDown();
		pdf.fontSize(12);
		const rows: [string, string][] = [
			[
				"Student",
				`${registration.student.name} (${registration.student.universityId})`,
			],
			["Semester", registration.semester.name],
			["Amount", `BDT ${taka(payment.amount)}`],
			["Transaction ID", payment.transactionId],
			["Paid on", payment.paidAt ? formatDhaka(payment.paidAt) : "-"],
			["Total paid", `BDT ${taka(registration.paidAmount)}`],
			[
				"Remaining due",
				`BDT ${taka(registration.totalFee.minus(registration.paidAmount))}`,
			],
		];
		for (const [label, value] of rows)
			pdf.text(`${label}: ${value}`).moveDown(0.3);
	});
};

const getAllPaymentsFromDB = async (query: IAdminPaymentQuery) => {
	const where: Prisma.PaymentWhereInput = {
		...(query.status ? { status: query.status } : {}),
		...(query.from || query.to
			? {
					createdAt: {
						...(query.from ? { gte: query.from } : {}),
						...(query.to ? { lte: query.to } : {}),
					},
				}
			: {}),
		...(query.batchId
			? { registration: { student: { batchId: query.batchId } } }
			: {}),
		...(query.searchTerm
			? {
					OR: [
						{
							registration: {
								student: {
									universityId: {
										contains: query.searchTerm,
										mode: "insensitive",
									},
								},
							},
						},
						{
							transactionId: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
						{
							providerTransactionId: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					],
				}
			: {}),
	};
	const [data, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			select: {
				...paymentSelect,
				registration: {
					select: {
						status: true,
						paymentStatus: true,
						semester: { select: { name: true } },
						student: {
							select: { universityId: true, name: true, batchId: true },
						},
					},
				},
			},
			orderBy: { [query.sortBy]: query.sortOrder },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
		}),
		prisma.payment.count({ where }),
	]);
	return {
		data,
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};

export const paymentService = {
	createPaymentIntoDB,
	completePaymentIntoDB,
	closePendingPaymentIntoDB,
	refundCancelledRegistrationPaymentIntoDB,
	updateRefundStatusIntoDB,
	getMyPaymentsFromDB,
	getPaymentByIdFromDB,
	getReceiptPdfFromDB,
	getAllPaymentsFromDB,
	refundCancelledPaidRegistrationIntoDB,
};
