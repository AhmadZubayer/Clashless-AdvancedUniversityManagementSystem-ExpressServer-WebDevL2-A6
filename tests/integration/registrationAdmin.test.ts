import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import {
	createAcademicWorld,
	createAdmin,
	createStudent,
} from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createAdmin>>;
let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let student: Awaited<ReturnType<typeof createStudent>>;
let semesterId: string;
let windowId: string;
let fullSectionId: string;
let candidateId: string;
let registrationId: string;
const auth = () => `Bearer ${tokenFor(admin)}`;
const path = (sectionId: string) =>
	`/api/admin/registrations/${student.student!.id}/sections/${sectionId}`;
const bypassAll = ["WINDOW", "TIME_CLASH", "CREDIT_LIMIT", "PREREQUISITE"];

beforeAll(async () => {
	admin = await createAdmin();
	world = await createAcademicWorld();
	student = await createStudent({ batch: world.batch, program: world.program });
	const semester = await prisma.semester.create({
		data: {
			code: "ADMIN-REG",
			name: "Admin registration",
			phase: "REGISTRATION",
			maxCredits: 3,
		},
	});
	semesterId = semester.id;
	const window = await prisma.registrationWindow.create({
		data: {
			semesterId,
			batchId: world.batch.id,
			startsAt: new Date(Date.now() - 3600000),
			endsAt: new Date(Date.now() + 3600000),
		},
	});
	windowId = window.id;
	const room = await prisma.room.create({
		data: {
			code: "ADMIN-ROOM",
			building: "Test",
			roomNo: "1",
			type: "CLASSROOM",
			capacity: 80,
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
		data: { code: "ADMIN-ST", type: "THEORY", days: ["SUN", "TUE"] },
	});
	const courses = ["ADMIN-FULL", "ADMIN-CANDIDATE", "ADMIN-PREREQ"].map(
		(code) => ({
			id: randomUUID(),
			code,
			title: code,
			credits: 3,
			type: "THEORY" as const,
			departmentId: world.department.id,
		}),
	);
	const offerings = courses
		.slice(0, 2)
		.map((course) => ({ id: randomUUID(), semesterId, courseId: course.id }));
	fullSectionId = randomUUID();
	candidateId = randomUUID();
	await prisma.$transaction([
		prisma.course.createMany({ data: courses }),
		prisma.courseOffering.createMany({ data: offerings }),
		prisma.section.createMany({
			data: [fullSectionId, candidateId].map((id, index) => ({
				id,
				offeringId: offerings[index].id,
				sectionNo: 1,
				capacity: 40,
				enrolledCount: index === 0 ? 40 : 0,
				roomId: room.id,
				timeSlotId: slot.id,
				dayPatternId: pattern.id,
			})),
		}),
		prisma.coursePrerequisite.create({
			data: { courseId: courses[1].id, prerequisiteId: courses[2].id },
		}),
	]);
	const users = Array.from({ length: 40 }, (_, index) => ({
		id: randomUUID(),
		name: `Existing ${index}`,
		email: `admin-existing-${index}@uni.edu`,
		role: "STUDENT" as const,
	}));
	const students = users.map((user, index) => ({
		id: randomUUID(),
		userId: user.id,
		name: user.name,
		email: user.email,
		universityId: `ADMIN-EXIST-${index}`,
		batchId: world.batch.id,
		programId: world.program.id,
	}));
	const registrations = students.map((row) => ({
		id: randomUUID(),
		studentId: row.id,
		semesterId,
		paymentDeadline: new Date(Date.now() + 10 * 86400000),
		totalCredits: 3,
		totalFee: 31500,
	}));
	await prisma.$transaction([
		prisma.user.createMany({ data: users }),
		prisma.student.createMany({ data: students }),
		prisma.semesterRegistration.createMany({ data: registrations }),
		prisma.enrollment.createMany({
			data: registrations.map((row) => ({
				studentId: row.studentId,
				semesterId,
				registrationId: row.id,
				sectionId: fullSectionId,
				offeringId: offerings[0].id,
				credits: 3,
			})),
		}),
	]);
});

it("T-REG-19 admin CAPACITY bypass expands a full section to 41 and audit-logs the enrollment", async () => {
	const blocked = await request(app)
		.post(path(fullSectionId))
		.set("Authorization", auth())
		.send({ reason: "No capacity bypass" });
	expect(blocked.status).toBe(409);
	expect(blocked.body.errorDetails.code).toBe("SECTION_FULL");
	const response = await request(app)
		.post(path(fullSectionId))
		.set("Authorization", auth())
		.send({ reason: "Approved manual seat", bypass: ["CAPACITY"] });
	expect(response.status).toBe(201);
	registrationId = response.body.data.registration.id;
	expect(
		await prisma.section.findUniqueOrThrow({ where: { id: fullSectionId } }),
	).toMatchObject({ capacity: 41, enrolledCount: 41 });
	expect(
		await prisma.enrollment.count({
			where: { sectionId: fullSectionId, status: "ENROLLED" },
		}),
	).toBe(41);
	const audit = await prisma.auditLog.findFirstOrThrow({
		where: {
			action: "MANUAL_ENROLL",
			entityId: response.body.data.enrollment.id,
		},
	});
	expect(audit).toMatchObject({
		actorId: admin.id,
		reason: "Approved manual seat",
	});
	expect(audit.after).toMatchObject({
		bypass: ["CAPACITY"],
		capacity: 41,
		enrolledCount: 41,
	});
});

it("F7 admin list filters at-risk bills and detail includes payments without user credentials", async () => {
	await prisma.semesterRegistration.update({
		where: { id: registrationId },
		data: {
			paymentDeadline: new Date(Date.now() + 2 * 86400000),
			paidAmount: 1000,
		},
	});
	await prisma.payment.create({
		data: {
			registrationId,
			amount: 1000,
			status: "COMPLETED",
			paidAt: new Date(),
		},
	});
	const list = await request(app)
		.get(
			`/api/admin/registrations?semesterId=${semesterId}&batchId=${world.batch.id}&atRisk=true&status=ACTIVE&paymentStatus=UNPAID&searchTerm=${encodeURIComponent(student.student!.universityId)}`,
		)
		.set("Authorization", auth());
	expect(list.status).toBe(200);
	expect(list.body.meta.total).toBe(1);
	expect(list.body.data[0].id).toBe(registrationId);
	const detail = await request(app)
		.get(
			`/api/admin/registrations/${student.student!.id}?semesterId=${semesterId}`,
		)
		.set("Authorization", auth());
	expect(detail.status).toBe(200);
	expect(detail.body.data.enrollments).toHaveLength(1);
	expect(detail.body.data.payments).toHaveLength(1);
	expect(detail.body.data.student).not.toHaveProperty("user");
	expect(detail.body.data.student).not.toHaveProperty("password");
});

it("F7 WINDOW bypass skips only the window check and retains time-clash enforcement", async () => {
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: {
			startsAt: new Date(Date.now() + 3600000),
			endsAt: new Date(Date.now() + 7200000),
		},
	});
	const window = await request(app)
		.post(path(candidateId))
		.set("Authorization", auth())
		.send({ reason: "Late add" });
	expect(window.status).toBe(403);
	expect(window.body.errorDetails.code).toBe("WINDOW_NOT_OPEN");
	const clash = await request(app)
		.post(path(candidateId))
		.set("Authorization", auth())
		.send({ reason: "Window override", bypass: ["WINDOW"] });
	expect(clash.status).toBe(409);
	expect(clash.body.errorDetails.code).toBe("TIME_CLASH");
});
it("F7 TIME_CLASH bypass retains credit-limit enforcement", async () => {
	const response = await request(app)
		.post(path(candidateId))
		.set("Authorization", auth())
		.send({ reason: "Clash override", bypass: ["WINDOW", "TIME_CLASH"] });
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("CREDIT_LIMIT");
});
it("F7 CREDIT_LIMIT bypass retains prerequisite enforcement", async () => {
	const response = await request(app)
		.post(path(candidateId))
		.set("Authorization", auth())
		.send({
			reason: "Credit override",
			bypass: ["WINDOW", "TIME_CLASH", "CREDIT_LIMIT"],
		});
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("PREREQUISITE_MISSING");
});
it("F7 all explicitly chosen bypasses enroll and recalculate the full bill", async () => {
	const response = await request(app)
		.post(path(candidateId))
		.set("Authorization", auth())
		.send({ reason: "Approved academic override", bypass: bypassAll });
	expect(response.status).toBe(201);
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "6",
		totalFee: "51000",
		paidAmount: "1000",
	});
	expect(
		(
			await prisma.auditLog.findFirstOrThrow({
				where: {
					entityId: response.body.data.enrollment.id,
					action: "MANUAL_ENROLL",
				},
			})
		).after,
	).toMatchObject({ bypass: bypassAll });
});
it("F7 admin removal ignores the closed window during CLASSES, retains payment and keeps dropped history", async () => {
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "CLASSES" },
	});
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: {
			startsAt: new Date(Date.now() - 7200000),
			endsAt: new Date(Date.now() - 3600000),
		},
	});
	const response = await request(app)
		.delete(path(fullSectionId))
		.set("Authorization", auth())
		.send({ reason: "Manual course removal" });
	expect(response.status).toBe(200);
	expect(response.body.data).toMatchObject({
		enrollment: { status: "DROPPED" },
		registration: { totalCredits: "3", totalFee: "31500", paidAmount: "1000" },
	});
	expect(
		await prisma.auditLog.count({
			where: {
				actorId: admin.id,
				action: "MANUAL_UNENROLL",
				entityId: response.body.data.enrollment.id,
			},
		}),
	).toBe(1);
	const detail = await request(app)
		.get(
			`/api/admin/registrations/${student.student!.id}?semesterId=${semesterId}`,
		)
		.set("Authorization", auth());
	expect(
		detail.body.data.enrollments
			.map((row: { status: string }) => row.status)
			.sort(),
	).toEqual(["DROPPED", "ENROLLED"]);
});
it("F7 admin registration routes enforce roles, reasons and permitted phases", async () => {
	const denied = await request(app)
		.get(`/api/admin/registrations?semesterId=${semesterId}`)
		.set("Authorization", `Bearer ${tokenFor(student)}`);
	expect(denied.status).toBe(403);
	const invalid = await request(app)
		.post(path(fullSectionId))
		.set("Authorization", auth())
		.send({ bypass: ["DISCARDED"] });
	expect(invalid.status).toBe(400);
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "EXAMS" },
	});
	const locked = await request(app)
		.delete(path(candidateId))
		.set("Authorization", auth())
		.send({ reason: "Too late" });
	expect(locked.status).toBe(409);
	expect(locked.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
});
