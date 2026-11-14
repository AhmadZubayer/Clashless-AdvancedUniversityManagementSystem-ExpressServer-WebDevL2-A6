import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import config from "../../src/app/config";
import { prisma } from "../../src/app/lib/prisma";
import {
	discardUnpaidRegistrations,
	sendPaymentReminders,
	settleAbandonedPayments,
} from "../../src/app/module/payment/payment.jobs";
import { tokenFor } from "../helpers/auth";
import {
	createAdmin,
	createRegistrationWorld,
	createStudent,
} from "../helpers/factory";
import { externalMocks } from "../helpers/mocks";

type World = Awaited<ReturnType<typeof createRegistrationWorld>>;
let world: World;
let admin: Awaited<ReturnType<typeof createAdmin>>;

const bearer = (user: Parameters<typeof tokenFor>[0]) =>
	`Bearer ${tokenFor(user)}`;
const FEE = 31500; // 3 credits x 6500 + 12000
const MIN = 12600; // ceil(40%)

// One extra section of a new course for the same semester.
async function addSection(options: {
	startMinute: number;
	enrollIn?: boolean;
}) {
	const course = await prisma.course.create({
		data: {
			code: `EXT-${randomUUID().slice(0, 8)}`,
			title: "Extra",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { courseId: course.id, semesterId: world.semester.id },
	});
	const timeSlot = await prisma.timeSlot.upsert({
		where: {
			unique_time_slot: { type: "THEORY", startMinute: options.startMinute },
		},
		update: {},
		create: {
			label: `slot-${options.startMinute}`,
			type: "THEORY",
			startMinute: options.startMinute,
			endMinute: options.startMinute + 90,
		},
	});
	const room = await prisma.room.create({
		data: {
			code: randomUUID().slice(0, 8),
			building: "FUB",
			roomNo: "9",
			type: "CLASSROOM",
			capacity: 40,
		},
	});
	const section = await prisma.section.create({
		data: {
			sectionNo: 1,
			offeringId: offering.id,
			facultyId: world.faculty.faculty!.id,
			capacity: 40,
			roomId: room.id,
			dayPatternId: world.dayPattern.id,
			timeSlotId: timeSlot.id,
		},
	});
	await prisma.routineEntry.create({
		data: {
			routineId: world.routine.id,
			sectionId: section.id,
			roomId: room.id,
			dayPatternId: world.dayPattern.id,
			timeSlotId: timeSlot.id,
		},
	});
	return { course, offering, section };
}

async function newBilledStudent(
	overrides: {
		paidAmount?: number;
		paymentStatus?: "UNPAID" | "MINIMUM_PAID" | "FULLY_PAID";
		totalFee?: number;
		deadline?: Date;
		status?: "ACTIVE" | "DISCARDED";
	} = {},
) {
	const user = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const registration = await prisma.semesterRegistration.create({
		data: {
			studentId: user.student!.id,
			semesterId: world.semester.id,
			status: overrides.status ?? "ACTIVE",
			totalCredits: 3,
			totalFee: overrides.totalFee ?? FEE,
			paidAmount: overrides.paidAmount ?? 0,
			paymentStatus: overrides.paymentStatus ?? "UNPAID",
			paymentDeadline:
				overrides.deadline ?? new Date(Date.now() + 86400000 * 10),
		},
	});
	return { user, registration };
}

async function startPayment(
	user: Parameters<typeof tokenFor>[0],
	amount: number,
) {
	const response = await request(app)
		.post("/api/payments/create")
		.set("Authorization", bearer(user))
		.send({ amount });
	const providerId: string = response.body.data?.paymentId
		? ((
				await prisma.payment.findUniqueOrThrow({
					where: { id: response.body.data.paymentId },
				})
			).providerTransactionId ?? "")
		: "";
	return { response, providerId };
}

const callback = (paymentID: string, status: string) =>
	request(app).get("/api/payments/bkash/callback").query({ paymentID, status });
const executed = (amount: number) =>
	externalMocks.bkashRequest.mockResolvedValueOnce({
		statusCode: "0000",
		transactionStatus: "Completed",
		amount: amount.toFixed(2),
		currency: "BDT",
	});

beforeAll(async () => {
	world = await createRegistrationWorld({ sections: 1 });
	admin = await createAdmin();
});
beforeEach(() => {
	externalMocks.bkashRequest.mockReset();
	externalMocks.refund.mockClear();
	externalMocks.checkout.mockImplementation(async () => ({
		providerTransactionId: randomUUID(),
		checkoutUrl: "https://sandbox.test/pay",
	}));
});

describe("payments", () => {
	it("T-PAY-01 amount below the minimum and above the remaining due", async () => {
		const { user } = await newBilledStudent();
		const low = await startPayment(user, MIN - 1);
		expect(low.response.status).toBe(400);
		expect(low.response.body.errorDetails.code).toBe("PAYMENT_AMOUNT_INVALID");
		expect(low.response.body.errorDetails.minimum).toBe("12600.00");
		expect(low.response.body.errorDetails.maximum).toBe("31500.00");
		const high = await startPayment(user, FEE + 1);
		expect(high.response.status).toBe(400);
		expect(high.response.body.errorDetails.code).toBe("PAYMENT_AMOUNT_INVALID");
	});

	it("T-PAY-02 valid payment returns the checkout URL and a PENDING payment", async () => {
		const { user } = await newBilledStudent();
		const { response } = await startPayment(user, MIN);
		expect(response.status).toBe(201);
		expect(response.body.data.checkoutUrl).toBe("https://sandbox.test/pay");
		const payment = await prisma.payment.findUniqueOrThrow({
			where: { id: response.body.data.paymentId },
		});
		expect(payment.status).toBe("PENDING");
		expect(payment.amount.toString()).toBe(String(MIN));
	});

	it("T-PAY-03 a second payment while one is PENDING is refused", async () => {
		const { user } = await newBilledStudent();
		expect((await startPayment(user, MIN)).response.status).toBe(201);
		const second = await startPayment(user, MIN);
		expect(second.response.status).toBe(409);
		expect(second.response.body.errorDetails.code).toBe("PAYMENT_IN_PROGRESS");
	});

	it("T-PAY-04 and T-PAY-05 a successful callback pays once and is idempotent", async () => {
		const { user, registration } = await newBilledStudent();
		const { response, providerId } = await startPayment(user, MIN);
		executed(MIN);
		const first = await callback(providerId, "success");
		expect(first.status).toBe(302);
		expect(first.headers.location).toBe(
			`${config.frontend_url}/payment/success`,
		);
		const paid = async () =>
			prisma.semesterRegistration.findUniqueOrThrow({
				where: { id: registration.id },
			});
		expect((await paid()).paidAmount.toString()).toBe(String(MIN));
		expect((await paid()).paymentStatus).toBe("MINIMUM_PAID");
		expect(
			(
				await prisma.payment.findUniqueOrThrow({
					where: { id: response.body.data.paymentId },
				})
			).status,
		).toBe("COMPLETED");
		const again = await callback(providerId, "success");
		expect(again.headers.location).toBe(
			`${config.frontend_url}/payment/success`,
		);
		expect((await paid()).paidAmount.toString()).toBe(String(MIN));
		expect(
			externalMocks.emails.some(
				(mail) =>
					mail.to === user.student!.email && mail.templateData.transactionId,
			),
		).toBe(true);
	});

	it("T-PAY-06 a cancelled callback leaves the registration unchanged", async () => {
		const { user, registration } = await newBilledStudent();
		const { response, providerId } = await startPayment(user, MIN);
		const result = await callback(providerId, "cancel");
		expect(result.headers.location).toBe(
			`${config.frontend_url}/payment/cancelled`,
		);
		expect(
			(
				await prisma.payment.findUniqueOrThrow({
					where: { id: response.body.data.paymentId },
				})
			).status,
		).toBe("CANCELLED");
		expect(
			(
				await prisma.semesterRegistration.findUniqueOrThrow({
					where: { id: registration.id },
				})
			).paidAmount.toString(),
		).toBe("0");
	});

	it("T-PAY-07 paying the rest makes the registration FULLY_PAID and blocks new payments", async () => {
		const { user, registration } = await newBilledStudent({
			paidAmount: MIN,
			paymentStatus: "MINIMUM_PAID",
		});
		const rest = FEE - MIN;
		const { providerId } = await startPayment(user, rest);
		executed(rest);
		await callback(providerId, "success");
		const row = await prisma.semesterRegistration.findUniqueOrThrow({
			where: { id: registration.id },
		});
		expect(row.paymentStatus).toBe("FULLY_PAID");
		const refused = await startPayment(user, 1);
		expect(refused.response.status).toBe(409);
	});

	it("T-PAY-08 a callback after the registration was DISCARDED runs the refund path", async () => {
		const { user, registration } = await newBilledStudent();
		const { response, providerId } = await startPayment(user, MIN);
		await prisma.semesterRegistration.update({
			where: { id: registration.id },
			data: { status: "DISCARDED", discardedAt: new Date() },
		});
		executed(MIN);
		const result = await callback(providerId, "success");
		expect(result.headers.location).toBe(
			`${config.frontend_url}/payment/cancelled`,
		);
		expect(externalMocks.refund).toHaveBeenCalledTimes(1);
		const row = await prisma.semesterRegistration.findUniqueOrThrow({
			where: { id: registration.id },
		});
		expect(row.status).toBe("DISCARDED");
		expect(row.paidAmount.toString()).toBe("0");
		expect(
			(
				await prisma.payment.findUniqueOrThrow({
					where: { id: response.body.data.paymentId },
				})
			).status,
		).toBe("REFUNDED");
	});

	it("T-PAY-09 a student cannot open another student's payment", async () => {
		const mine = await newBilledStudent();
		const other = await newBilledStudent();
		const { response } = await startPayment(mine.user, MIN);
		const id = response.body.data.paymentId;
		const denied = await request(app)
			.get(`/api/payments/${id}`)
			.set("Authorization", bearer(other.user));
		expect(denied.status).toBe(403);
		const owner = await request(app)
			.get(`/api/payments/${id}`)
			.set("Authorization", bearer(mine.user));
		expect(owner.status).toBe(200);
		const list = await request(app)
			.get("/api/payments/me")
			.set("Authorization", bearer(mine.user));
		expect(list.body.data).toHaveLength(1);
		const adminList = await request(app)
			.get("/api/admin/payments")
			.query({ status: "PENDING", searchTerm: mine.user.student!.universityId })
			.set("Authorization", bearer(admin));
		expect(adminList.status).toBe(200);
		expect(adminList.body.meta.total).toBe(1);
	});

	it("T-PAY-10 the receipt of a COMPLETED payment is a PDF", async () => {
		const { user } = await newBilledStudent();
		const { response, providerId } = await startPayment(user, MIN);
		const id = response.body.data.paymentId;
		const early = await request(app)
			.get(`/api/payments/${id}/receipt`)
			.set("Authorization", bearer(user));
		expect(early.status).toBe(409);
		executed(MIN);
		await callback(providerId, "success");
		const receipt = await request(app)
			.get(`/api/payments/${id}/receipt`)
			.set("Authorization", bearer(user))
			.buffer(true)
			.parse((res, done) => {
				const chunks: Buffer[] = [];
				res.on("data", (chunk: Buffer) => chunks.push(chunk));
				res.on("end", () => done(null, Buffer.concat(chunks)));
			});
		expect(receipt.status).toBe(200);
		expect(receipt.headers["content-type"]).toContain("application/pdf");
		expect((receipt.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
	});

	it("T-PAY-11 selecting another course after paying 40% can drop the status back to UNPAID", async () => {
		const user = await createStudent({
			batch: world.batch,
			program: world.program,
		});
		const select = (sectionId: string) =>
			request(app)
				.post(`/api/registrations/sections/${sectionId}`)
				.set("Authorization", bearer(user));
		expect((await select(world.sections[0].id)).status).toBe(201);
		const { providerId } = await startPayment(user, MIN);
		executed(MIN);
		await callback(providerId, "success");
		const read = () =>
			prisma.semesterRegistration.findFirstOrThrow({
				where: { studentId: user.student!.id },
			});
		expect((await read()).paymentStatus).toBe("MINIMUM_PAID");
		const extra = await addSection({ startMinute: 700 });
		expect((await select(extra.section.id)).status).toBe(201);
		const after = await read();
		expect(after.totalFee.toString()).toBe("51000");
		expect(after.paymentStatus).toBe("UNPAID");
	});
});

describe("background jobs", () => {
	it("T-JOB-01 discards an unpaid registration with three courses", async () => {
		const { user, registration } = await newBilledStudent({
			deadline: new Date(Date.now() - 60000),
		});
		const sections = [
			world.sections[0],
			(await addSection({ startMinute: 800 })).section,
			(await addSection({ startMinute: 900 })).section,
		];
		for (const section of sections) {
			await prisma.enrollment.create({
				data: {
					registrationId: registration.id,
					studentId: user.student!.id,
					sectionId: section.id,
					offeringId: section.offeringId,
					semesterId: world.semester.id,
					credits: 3,
				},
			});
			await prisma.section.update({
				where: { id: section.id },
				data: { enrolledCount: { increment: 1 } },
			});
		}
		const before = await Promise.all(
			sections.map((section) =>
				prisma.section.findUniqueOrThrow({ where: { id: section.id } }),
			),
		);
		const emails = externalMocks.emails.length;
		await discardUnpaidRegistrations();
		const row = await prisma.semesterRegistration.findUniqueOrThrow({
			where: { id: registration.id },
		});
		expect(row.status).toBe("DISCARDED");
		const enrollments = await prisma.enrollment.findMany({
			where: { registrationId: registration.id },
		});
		expect(enrollments.every((item) => item.status === "DISCARDED")).toBe(true);
		for (const [index, section] of sections.entries()) {
			const after = await prisma.section.findUniqueOrThrow({
				where: { id: section.id },
			});
			expect(after.enrolledCount).toBe(before[index].enrolledCount - 1);
		}
		expect(externalMocks.emails.length).toBe(emails + 1);
		expect(
			await prisma.notification.count({
				where: { userId: user.id, type: "DISCARDED" },
			}),
		).toBe(1);
		const audit = await prisma.auditLog.findFirstOrThrow({
			where: { entityId: registration.id, action: "REGISTRATION_DISCARDED" },
		});
		expect(audit.actorId).toBeNull();
	});

	it("T-JOB-02 leaves MINIMUM_PAID, not-yet-due and zero-fee registrations alone", async () => {
		const paid = await newBilledStudent({
			deadline: new Date(Date.now() - 60000),
			paidAmount: MIN,
			paymentStatus: "MINIMUM_PAID",
		});
		const early = await newBilledStudent({
			deadline: new Date(Date.now() + 3600000),
		});
		const free = await newBilledStudent({
			deadline: new Date(Date.now() - 60000),
			totalFee: 0,
		});
		await discardUnpaidRegistrations();
		for (const item of [paid, early, free])
			expect(
				(
					await prisma.semesterRegistration.findUniqueOrThrow({
						where: { id: item.registration.id },
					})
				).status,
			).toBe("ACTIVE");
	});

	it("T-JOB-03 running the discard job twice changes nothing the second time", async () => {
		const { registration } = await newBilledStudent({
			deadline: new Date(Date.now() - 60000),
		});
		const first = await discardUnpaidRegistrations();
		expect(first.discarded).toBeGreaterThanOrEqual(1);
		const audits = await prisma.auditLog.count({
			where: { entityId: registration.id },
		});
		const second = await discardUnpaidRegistrations();
		expect(second.discarded).toBe(0);
		expect(
			await prisma.auditLog.count({ where: { entityId: registration.id } }),
		).toBe(audits);
	});

	it("T-JOB-04 reminders go only to 5, 2 and 1 day deadlines", async () => {
		const day = 86400000;
		const students = [] as Awaited<ReturnType<typeof newBilledStudent>>[];
		for (const days of [5, 2, 1, 3])
			students.push(
				await newBilledStudent({
					deadline: new Date(Date.now() + days * day - 60000),
				}),
			);
		const start = externalMocks.emails.length;
		await sendPaymentReminders();
		const recipients = externalMocks.emails.slice(start).map((mail) => mail.to);
		for (const [index, item] of students.entries())
			expect(recipients.includes(item.user.student!.email)).toBe(index !== 3);
	});

	it("T-JOB-05 an abandoned PENDING payment is settled with bKash like the callback", async () => {
		const { user, registration } = await newBilledStudent();
		const { response, providerId } = await startPayment(user, MIN);
		await prisma.payment.update({
			where: { id: response.body.data.paymentId },
			data: { createdAt: new Date(Date.now() - 31 * 60000) },
		});
		externalMocks.bkashRequest.mockResolvedValueOnce({
			statusCode: "0000",
			transactionStatus: "Completed",
			amount: MIN.toFixed(2),
			currency: "BDT",
			paymentID: providerId,
		});
		await settleAbandonedPayments();
		const payment = await prisma.payment.findUniqueOrThrow({
			where: { id: response.body.data.paymentId },
		});
		expect(payment.status).toBe("COMPLETED");
		const row = await prisma.semesterRegistration.findUniqueOrThrow({
			where: { id: registration.id },
		});
		expect(row.paidAmount.toString()).toBe(String(MIN));
		expect(row.paymentStatus).toBe("MINIMUM_PAID");
	});
});
