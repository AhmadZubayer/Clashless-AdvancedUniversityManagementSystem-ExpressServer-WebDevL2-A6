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
let otherStudent: Awaited<ReturnType<typeof createStudent>>;
let semesterId: string;
let windowId: string;
let otherWindowId: string;
let courseId: string;
const authorization = () => `Bearer ${tokenFor(admin)}`;
const phase = (id: string, value: string) =>
	request(app)
		.patch(`/api/admin/semesters/${id}/phase`)
		.set("Authorization", authorization())
		.send({ phase: value });
const windowBody = () => ({
	semesterId,
	batchId: world.batch.id,
	startsAt: new Date(Date.now() + 3600000).toISOString(),
	endsAt: new Date(Date.now() + 7200000).toISOString(),
});

beforeAll(async () => {
	admin = await createAdmin();
	world = await createAcademicWorld();
	student = await createStudent({ batch: world.batch, program: world.program });
	const otherBatch = await prisma.batch.create({
		data: { code: "25-1", intakeYear: 2025, intakeTerm: 1 },
	});
	otherStudent = await createStudent({
		batch: otherBatch,
		program: world.program,
	});
	expect(
		(
			await request(app)
				.get("/api/semesters/current")
				.set("Authorization", authorization())
		).status,
	).toBe(404);
	const created = await request(app)
		.post("/api/admin/semesters")
		.set("Authorization", authorization())
		.send({ code: "F4-PRIMARY", name: "Primary semester" });
	expect(created.status).toBe(201);
	expect(created.body.data.phase).toBe("PLANNING");
	expect(created.body.data.maxCredits).toBe("15");
	expect(created.body.data.minPaymentPercent).toBe(40);
	expect(created.body.data.paymentDeadlineDays).toBe(12);
	semesterId = created.body.data.id;
	const other = await prisma.registrationWindow.create({
		data: {
			...windowBody(),
			batchId: otherBatch.id,
			startsAt: new Date(Date.now() + 3600000),
			endsAt: new Date(Date.now() + 7200000),
		},
	});
	otherWindowId = other.id;
	const course = await prisma.course.create({
		data: {
			code: "SEM101",
			title: "Semester test",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	courseId = course.id;
});

it("T-SEM-01 another non-CLOSED semester prevents creation", async () => {
	expect(
		(
			await request(app)
				.post("/api/admin/semesters")
				.set("Authorization", authorization())
				.send({ code: "F4-SECOND", name: "Second semester" })
		).status,
	).toBe(409);
	const list = await request(app)
		.get("/api/semesters?searchTerm=Primary&limit=2")
		.set("Authorization", authorization());
	expect(list.status).toBe(200);
	expect(list.body.meta.total).toBe(1);
	const detail = await request(app)
		.get(`/api/admin/semesters/${semesterId}`)
		.set("Authorization", authorization());
	expect(detail.status).toBe(200);
	expect(detail.body.data.counts).toEqual({
		offerings: 0,
		sections: 0,
		registrations: 0,
	});
});
it("T-SEM-02 cannot skip PLANNING to CLASSES", async () => {
	const response = await phase(semesterId, "CLASSES");
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.gate).toBe("NEXT_PHASE");
});
it("T-SEM-03 registration requires a published class routine", async () => {
	const response = await phase(semesterId, "REGISTRATION");
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.gate).toBe("PUBLISHED_CLASS_ROUTINE");
	expect(response.body.message).toMatch(/published class routine/i);
});
it("T-SEM-04 rule fields lock after planning while dates remain editable", async () => {
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
	const response = await request(app)
		.patch(`/api/admin/semesters/${semesterId}`)
		.set("Authorization", authorization())
		.send({ maxCredits: 18 });
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	const date = await request(app)
		.patch(`/api/admin/semesters/${semesterId}`)
		.set("Authorization", authorization())
		.send({ gradeDeadline: "2027-01-01T08:00:00+06:00" });
	expect(date.status).toBe(200);
	expect(date.body.data.gradeDeadline).toBe("2027-01-01T02:00:00.000Z");
	expect(date.body.data.maxCredits).toBe("15");
	expect(
		(
			await request(app)
				.patch(`/api/admin/semesters/${semesterId}`)
				.set("Authorization", authorization())
				.send({ gradeDeadline: "2027-01-01T08:00:00" })
		).status,
	).toBe(400);
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "PLANNING" },
	});
});
it("T-SEM-05 window end must be after start", async () => {
	const body = windowBody();
	expect(
		(
			await request(app)
				.post("/api/admin/registration-windows")
				.set("Authorization", authorization())
				.send({ ...body, endsAt: body.startsAt })
		).status,
	).toBe(400);
});
it("T-SEM-06 one registration window per batch and semester", async () => {
	const body = windowBody();
	const response = await request(app)
		.post("/api/admin/registration-windows")
		.set("Authorization", authorization())
		.send(body);
	expect(response.status).toBe(201);
	windowId = response.body.data.id;
	expect(
		(
			await request(app)
				.post("/api/admin/registration-windows")
				.set("Authorization", authorization())
				.send(body)
		).status,
	).toBe(409);
});
it("T-SEM-07 running extension moves only that batch's payment deadline and is audited", async () => {
	const now = Date.now();
	const oldEnd = new Date(now + 3600000);
	const newEnd = new Date(now + 10800000);
	const oldDeadline = new Date(oldEnd.getTime() + 12 * 86400000);
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: { startsAt: new Date(now - 60000), endsAt: oldEnd },
	});
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
	await prisma.semesterRegistration.createMany({
		data: [student, otherStudent].map((user) => ({
			semesterId,
			studentId: user.student!.id,
			paymentDeadline: oldDeadline,
		})),
	});
	const response = await request(app)
		.patch(`/api/admin/registration-windows/${windowId}`)
		.set("Authorization", authorization())
		.send({ endsAt: newEnd.toISOString(), reason: "Extra registration time" });
	expect(response.status).toBe(200);
	const registrations = await prisma.semesterRegistration.findMany({
		where: { semesterId },
	});
	expect(
		registrations
			.find((row) => row.studentId === student.student!.id)
			?.paymentDeadline.toISOString(),
	).toBe(new Date(newEnd.getTime() + 12 * 86400000).toISOString());
	expect(
		registrations
			.find((row) => row.studentId === otherStudent.student!.id)
			?.paymentDeadline.toISOString(),
	).toBe(oldDeadline.toISOString());
	expect(
		await prisma.auditLog.count({
			where: {
				entityId: windowId,
				action: "REGISTRATION_WINDOW_EXTENDED",
				reason: "Extra registration time",
			},
		}),
	).toBe(1);
});
it("T-SEM-08 running windows reject start changes and shortening", async () => {
	expect(
		(
			await request(app)
				.patch(`/api/admin/registration-windows/${windowId}`)
				.set("Authorization", authorization())
				.send({
					startsAt: new Date(Date.now() + 1000).toISOString(),
					reason: "Change start",
				})
		).status,
	).toBe(409);
	expect(
		(
			await request(app)
				.patch(`/api/admin/registration-windows/${windowId}`)
				.set("Authorization", authorization())
				.send({
					endsAt: new Date(Date.now() + 1000).toISOString(),
					reason: "Shorten",
				})
		).status,
	).toBe(409);
	expect(
		(
			await request(app)
				.patch(`/api/admin/registration-windows/${windowId}`)
				.set("Authorization", authorization())
				.send({ endsAt: new Date(Date.now() + 20000000).toISOString() })
		).status,
	).toBe(400);
});
it("T-SEM-09 students see only their batch window with serverTime", async () => {
	const studentAuthorization = `Bearer ${tokenFor(student)}`;
	const response = await request(app)
		.get(`/api/registration-windows?semesterId=${semesterId}`)
		.set("Authorization", studentAuthorization);
	expect(response.status).toBe(200);
	expect(response.body.data).toHaveLength(1);
	expect(response.body.data[0].batchId).toBe(world.batch.id);
	expect(Number.isFinite(Date.parse(response.body.data[0].serverTime))).toBe(
		true,
	);
	const current = await request(app)
		.get("/api/semesters/current")
		.set("Authorization", studentAuthorization);
	expect(current.status).toBe(200);
	expect(current.body.data.registrationWindow.id).toBe(windowId);
	expect(current.body.data.serverTime).toBeTruthy();
	const all = await request(app)
		.get(`/api/registration-windows?semesterId=${semesterId}`)
		.set("Authorization", authorization());
	expect(all.body.meta.total).toBe(2);
	expect((await phaseAsStudent()).status).toBe(403);
	function phaseAsStudent() {
		return request(app)
			.patch(`/api/admin/semesters/${semesterId}/phase`)
			.set("Authorization", studentAuthorization)
			.send({ phase: "CLASSES" });
	}
});

it("F4 future windows allow edits and deletion; ended windows reject both", async () => {
	const batch = await prisma.batch.create({
		data: { code: "26-2", intakeYear: 2026, intakeTerm: 2 },
	});
	const created = await request(app)
		.post("/api/admin/registration-windows")
		.set("Authorization", authorization())
		.send({ ...windowBody(), batchId: batch.id });
	expect(created.status).toBe(201);
	const changed = await request(app)
		.patch(`/api/admin/registration-windows/${created.body.data.id}`)
		.set("Authorization", authorization())
		.send({
			startsAt: new Date(Date.now() + 7200000).toISOString(),
			endsAt: new Date(Date.now() + 10800000).toISOString(),
		});
	expect(changed.status).toBe(200);
	expect(
		(
			await request(app)
				.delete(`/api/admin/registration-windows/${created.body.data.id}`)
				.set("Authorization", authorization())
		).status,
	).toBe(200);
	await prisma.registrationWindow.update({
		where: { id: otherWindowId },
		data: {
			startsAt: new Date(Date.now() - 120000),
			endsAt: new Date(Date.now() - 60000),
		},
	});
	expect(
		(
			await request(app)
				.patch(`/api/admin/registration-windows/${otherWindowId}`)
				.set("Authorization", authorization())
				.send({
					endsAt: new Date(Date.now() + 7200000).toISOString(),
					reason: "Too late",
				})
		).status,
	).toBe(409);
	expect(
		(
			await request(app)
				.delete(`/api/admin/registration-windows/${otherWindowId}`)
				.set("Authorization", authorization())
		).status,
	).toBe(409);
});
it("F4 registration gate also requires a window and successful transition is audited", async () => {
	const semester = await prisma.semester.create({
		data: {
			code: "GATE-REG",
			name: "Registration gate",
			routines: { create: { version: 1, status: "PUBLISHED" } },
		},
	});
	const missing = await phase(semester.id, "REGISTRATION");
	expect(missing.status).toBe(409);
	expect(missing.body.errorDetails.gate).toBe("REGISTRATION_WINDOW");
	await prisma.registrationWindow.create({
		data: {
			semesterId: semester.id,
			batchId: world.batch.id,
			startsAt: new Date(),
			endsAt: new Date(Date.now() + 3600000),
		},
	});
	expect((await phase(semester.id, "REGISTRATION")).status).toBe(200);
	expect(
		await prisma.auditLog.count({
			where: { entityId: semester.id, action: "SEMESTER_PHASE_CHANGED" },
		}),
	).toBe(1);
});
it("F4 CLASSES waits until every registration window ends", async () => {
	const semester = await prisma.semester.create({
		data: { code: "GATE-CLASS", name: "Classes gate", phase: "REGISTRATION" },
	});
	const window = await prisma.registrationWindow.create({
		data: {
			semesterId: semester.id,
			batchId: world.batch.id,
			startsAt: new Date(Date.now() - 60000),
			endsAt: new Date(Date.now() + 3600000),
		},
	});
	expect((await phase(semester.id, "CLASSES")).body.errorDetails.gate).toBe(
		"WINDOWS_ENDED",
	);
	await prisma.registrationWindow.update({
		where: { id: window.id },
		data: { endsAt: new Date(Date.now() - 1000) },
	});
	expect((await phase(semester.id, "CLASSES")).status).toBe(200);
});
it("F4 EXAMS requires published exam routine and every used slot's published plan", async () => {
	const semester = await prisma.semester.create({
		data: { code: "GATE-EXAM", name: "Exam gate", phase: "CLASSES" },
	});
	expect((await phase(semester.id, "EXAMS")).body.errorDetails.gate).toBe(
		"PUBLISHED_EXAM_ROUTINE",
	);
	await prisma.examRoutine.create({
		data: { semesterId: semester.id, version: 1, status: "PUBLISHED" },
	});
	const slot = await prisma.examSlot.create({
		data: {
			semesterId: semester.id,
			date: new Date("2027-01-01"),
			startMinute: 540,
			endMinute: 660,
		},
	});
	await prisma.courseOffering.create({
		data: { semesterId: semester.id, courseId, examSlotId: slot.id },
	});
	expect((await phase(semester.id, "EXAMS")).body.errorDetails.gate).toBe(
		"PUBLISHED_SEAT_PLANS",
	);
	await prisma.seatPlan.create({
		data: { semesterId: semester.id, examSlotId: slot.id, status: "PUBLISHED" },
	});
	expect((await phase(semester.id, "EXAMS")).status).toBe(200);
	expect((await phase(semester.id, "GRADING")).status).toBe(200);
});
it("F4 CLOSED requires published CourseResults rather than draft enrollment grades", async () => {
	const semester = await prisma.semester.create({
		data: { code: "GATE-GRADE", name: "Grade gate", phase: "GRADING" },
	});
	const offering = await prisma.courseOffering.create({
		data: {
			semesterId: semester.id,
			courseId,
			sections: { create: { sectionNo: 1 } },
		},
		include: { sections: true },
	});
	await prisma.semesterRegistration.create({
		data: {
			semesterId: semester.id,
			studentId: student.student!.id,
			paymentDeadline: new Date(),
			enrollments: {
				create: {
					studentId: student.student!.id,
					semesterId: semester.id,
					offeringId: offering.id,
					sectionId: offering.sections[0].id,
					credits: 3,
					grade: "B",
				},
			},
		},
	});
	expect((await phase(semester.id, "CLOSED")).body.errorDetails.gate).toBe(
		"GRADES_PUBLISHED",
	);
	await prisma.courseResult.create({
		data: {
			semesterId: semester.id,
			studentId: student.student!.id,
			courseId,
			grade: "B",
			gradePoint: 3,
			credits: 3,
		},
	});
	expect((await phase(semester.id, "CLOSED")).status).toBe(200);
	expect((await phase(semester.id, "PLANNING")).status).toBe(409);
});
