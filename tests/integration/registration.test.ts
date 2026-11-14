import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import { createAcademicWorld, createStudent } from "../helpers/factory";

let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let student: Awaited<ReturnType<typeof createStudent>>;
let semesterId: string;
let sectionId: string;
let alternativeId: string;
let windowId: string;
let windowEnd: Date;
const authorization = () => `Bearer ${tokenFor(student)}`;
let originalEnrollmentId: string;
let targetStudent: Awaited<ReturnType<typeof createStudent>>;
beforeAll(async () => {
	world = await createAcademicWorld();
	student = await createStudent({ batch: world.batch, program: world.program });
	const semester = await prisma.semester.create({
		data: { code: "F7-REG", name: "Registration test", phase: "REGISTRATION" },
	});
	semesterId = semester.id;
	windowEnd = new Date(Date.now() + 3600000);
	const window = await prisma.registrationWindow.create({
		data: {
			batchId: world.batch.id,
			semesterId,
			startsAt: new Date(Date.now() - 3600000),
			endsAt: windowEnd,
		},
	});
	windowId = window.id;
	const course = await prisma.course.create({
		data: {
			code: "F7-C1",
			title: "Registration course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const room = await prisma.room.create({
		data: {
			code: "F7-R1",
			building: "F7",
			roomNo: "1",
			type: "CLASSROOM",
			capacity: 100,
		},
	});
	const slot = await prisma.timeSlot.create({
		data: {
			label: "08:30-10:00",
			type: "THEORY",
			startMinute: 510,
			endMinute: 600,
		},
	});
	const pattern = await prisma.dayPattern.create({
		data: { code: "F7-ST", type: "THEORY", days: ["SUN", "TUE"] },
	});
	const section = await prisma.section.create({
		data: {
			offeringId: offering.id,
			sectionNo: 1,
			roomId: room.id,
			dayPatternId: pattern.id,
			timeSlotId: slot.id,
		},
	});
	sectionId = section.id;
	alternativeId = (
		await prisma.section.create({
			data: {
				offeringId: offering.id,
				sectionNo: 2,
				roomId: room.id,
				dayPatternId: pattern.id,
				timeSlotId: slot.id,
			},
		})
	).id;
});
it("T-REG-01 selections before and after the batch window are forbidden", async () => {
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: { startsAt: new Date(Date.now() + 100000) },
	});
	const before = await request(app)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(before.status).toBe(403);
	expect(before.body.errorDetails.code).toBe("WINDOW_NOT_OPEN");
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: {
			startsAt: new Date(Date.now() - 100000),
			endsAt: new Date(Date.now() - 1000),
		},
	});
	const after = await request(app)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(after.status).toBe(403);
	expect(after.body.errorDetails.code).toBe("WINDOW_CLOSED");
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: { endsAt: windowEnd },
	});
});
it("T-REG-02 selections require REGISTRATION phase", async () => {
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "PLANNING" },
	});
	const response = await request(app)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
});
it("T-REG-03 first select creates a bill with exact credits, fee and batch-relative deadline", async () => {
	const response = await request(app)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(201);
	expect(response.body.data.enrollment.status).toBe("ENROLLED");
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "3",
		totalFee: "31500",
		paidAmount: "0",
		paymentStatus: "UNPAID",
		paymentDeadline: new Date(
			windowEnd.getTime() + 12 * 86400000,
		).toISOString(),
	});
	const repeated = await request(app)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(repeated.status).toBe(200);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(1);
});
it("T-REG-04 another section of the same course is rejected", async () => {
	const response = await request(app)
		.post(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("ALREADY_HAS_COURSE");
});
it("T-REG-13 unselect drops the enrollment and removes the semester fee without refunding paid credit", async () => {
	const bill = await prisma.semesterRegistration.findUniqueOrThrow({
		where: {
			unique_student_semester: { studentId: student.student!.id, semesterId },
		},
	});
	await prisma.semesterRegistration.update({
		where: { id: bill.id },
		data: { paidAmount: 10000 },
	});
	const response = await request(app)
		.delete(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(200);
	expect(response.body.data.enrollment.status).toBe("DROPPED");
	originalEnrollmentId = response.body.data.enrollment.id;
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "0",
		totalFee: "0",
		paidAmount: "10000",
		paymentStatus: "FULLY_PAID",
	});
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(0);
});
it("T-REG-14 selecting again reuses the original dropped enrollment", async () => {
	const response = await request(app)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(201);
	expect(response.body.data.enrollment).toMatchObject({
		id: originalEnrollmentId,
		status: "ENROLLED",
		droppedAt: null,
	});
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "3",
		totalFee: "31500",
		paidAmount: "10000",
		paymentStatus: "UNPAID",
	});
});
it("T-REG-15 switching to a full section retains the source enrollment and count", async () => {
	targetStudent = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	await prisma.section.update({
		where: { id: alternativeId },
		data: { capacity: 1 },
	});
	const fill = await request(app)
		.post(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", `Bearer ${tokenFor(targetStudent)}`);
	expect(fill.status).toBe(201);
	const response = await request(app)
		.post("/api/registrations/switch")
		.set("Authorization", authorization())
		.send({ fromSectionId: sectionId, toSectionId: alternativeId });
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("SECTION_FULL");
	expect(
		(
			await prisma.enrollment.findUniqueOrThrow({
				where: { id: originalEnrollmentId },
			})
		).status,
	).toBe("ENROLLED");
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(1);
});
it("T-REG-16 switching to an available section changes both counts and preserves billing", async () => {
	const release = await request(app)
		.delete(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", `Bearer ${tokenFor(targetStudent)}`);
	expect(release.status).toBe(200);
	const response = await request(app)
		.post("/api/registrations/switch")
		.set("Authorization", authorization())
		.send({ fromSectionId: sectionId, toSectionId: alternativeId });
	expect(response.status).toBe(200);
	expect(response.body.data.fromEnrollment).toMatchObject({
		id: originalEnrollmentId,
		status: "DROPPED",
	});
	expect(response.body.data.enrollment).toMatchObject({
		sectionId: alternativeId,
		status: "ENROLLED",
		credits: "3",
	});
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "3",
		totalFee: "31500",
		paidAmount: "10000",
	});
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(0);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: alternativeId } }))
			.enrolledCount,
	).toBe(1);
});
it("F7 opposite switches do not deadlock and both complete when capacity allows", async () => {
	await prisma.section.update({
		where: { id: alternativeId },
		data: { capacity: 4 },
	});
	const left = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const right = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	for (const [user, id] of [
		[left, sectionId],
		[right, alternativeId],
	] as const)
		expect(
			(
				await request(app)
					.post(`/api/registrations/sections/${id}`)
					.set("Authorization", `Bearer ${tokenFor(user)}`)
			).status,
		).toBe(201);
	const responses = await Promise.all([
		request(app)
			.post("/api/registrations/switch")
			.set("Authorization", `Bearer ${tokenFor(left)}`)
			.send({ fromSectionId: sectionId, toSectionId: alternativeId }),
		request(app)
			.post("/api/registrations/switch")
			.set("Authorization", `Bearer ${tokenFor(right)}`)
			.send({ fromSectionId: alternativeId, toSectionId: sectionId }),
	]);
	expect(responses.map((response) => response.status)).toEqual([200, 200]);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(1);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: alternativeId } }))
			.enrolledCount,
	).toBe(2);
});
it("T-REG-11 parallel selections by one student serialize the credit-limit check", async () => {
	const user = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const courses = Array.from({ length: 7 }, (_, index) => ({
		id: randomUUID(),
		code: `F7-PARALLEL-${index}`,
		title: `Parallel ${index}`,
		credits: 3,
		type: "THEORY" as const,
		departmentId: world.department.id,
	}));
	const offerings = courses.map((course) => ({
		id: randomUUID(),
		courseId: course.id,
		semesterId,
	}));
	const slots = courses.map((_course, index) => ({
		id: randomUUID(),
		label: `Parallel ${index}`,
		type: "THEORY" as const,
		startMinute: 610 + index * 90,
		endMinute: 700 + index * 90,
	}));
	const sections = offerings.map((offering, index) => ({
		id: randomUUID(),
		offeringId: offering.id,
		sectionNo: 1,
		roomId: original.roomId,
		dayPatternId: original.dayPatternId,
		timeSlotId: slots[index].id,
		enrolledCount: index < 2 ? 1 : 0,
	}));
	await prisma.$transaction([
		prisma.course.createMany({ data: courses }),
		prisma.courseOffering.createMany({ data: offerings }),
		prisma.timeSlot.createMany({ data: slots }),
		prisma.section.createMany({ data: sections }),
	]);
	const registration = await prisma.semesterRegistration.create({
		data: {
			semesterId,
			studentId: user.student!.id,
			paymentDeadline: new Date(windowEnd.getTime() + 12 * 86400000),
			totalCredits: 6,
			totalFee: 51000,
		},
	});
	await prisma.enrollment.createMany({
		data: sections.slice(0, 2).map((section) => ({
			studentId: user.student!.id,
			semesterId,
			registrationId: registration.id,
			sectionId: section.id,
			offeringId: section.offeringId,
			credits: 3,
		})),
	});
	const responses = await Promise.all(
		sections.slice(2).map((section) =>
			request(app)
				.post(`/api/registrations/sections/${section.id}`)
				.set("Authorization", `Bearer ${tokenFor(user)}`),
		),
	);
	expect(responses.filter((response) => response.status === 201)).toHaveLength(
		3,
	);
	expect(
		responses.filter(
			(response) =>
				response.status === 409 &&
				response.body.errorDetails.code === "CREDIT_LIMIT",
		),
	).toHaveLength(2);
	expect(
		(
			await prisma.semesterRegistration.findUniqueOrThrow({
				where: { id: registration.id },
			})
		).totalCredits.toString(),
	).toBe("15");
	expect(
		await prisma.enrollment.count({
			where: { registrationId: registration.id, status: "ENROLLED" },
		}),
	).toBe(5);
});
it("T-REG-10 one hundred students race for exactly forty seats", async () => {
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const course = await prisma.course.create({
		data: {
			code: "F7-RACE",
			title: "Concurrency course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const section = await prisma.section.create({
		data: {
			offeringId: offering.id,
			sectionNo: 1,
			capacity: 40,
			roomId: original.roomId,
			dayPatternId: original.dayPatternId,
			timeSlotId: original.timeSlotId,
		},
	});
	const users = Array.from({ length: 100 }, (_, index) => ({
		id: randomUUID(),
		name: `Race ${index}`,
		email: `race-${index}@uni.edu`,
		role: "STUDENT" as const,
		tokenVersion: 0,
		emailVerified: true,
	}));
	await prisma.$transaction([
		prisma.user.createMany({ data: users }),
		prisma.student.createMany({
			data: users.map((user, index) => ({
				id: randomUUID(),
				name: user.name,
				email: user.email,
				universityId: `F7-RACE-${index}`,
				userId: user.id,
				programId: world.program.id,
				batchId: world.batch.id,
			})),
		}),
	]);
	const responses = await Promise.all(
		users.map((user) =>
			request(app)
				.post(`/api/registrations/sections/${section.id}`)
				.set("Authorization", `Bearer ${tokenFor(user)}`),
		),
	);
	expect(responses.filter((response) => response.status === 201)).toHaveLength(
		40,
	);
	expect(
		responses.filter(
			(response) =>
				response.status === 409 &&
				response.body.errorDetails.code === "SECTION_FULL",
		),
	).toHaveLength(60);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: section.id } }))
			.enrolledCount,
	).toBe(40);
	expect(
		await prisma.enrollment.count({
			where: { sectionId: section.id, status: "ENROLLED" },
		}),
	).toBe(40);
}, 120000);
