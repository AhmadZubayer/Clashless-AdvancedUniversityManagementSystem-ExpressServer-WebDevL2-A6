import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import {
	createAcademicWorld,
	createAdmin,
	createFaculty,
} from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createAdmin>>;
let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let teacher: Awaited<ReturnType<typeof createFaculty>>;
let semesterId: string;
let sectionId: string;
let routineId: string;
const authorization = () => `Bearer ${tokenFor(admin)}`;
beforeAll(async () => {
	admin = await createAdmin();
	world = await createAcademicWorld();
	teacher = await createFaculty(world.department.id);
	const semester = await prisma.semester.create({
		data: { code: "F6-ROUTINE", name: "Routine semester" },
	});
	semesterId = semester.id;
	const course = await prisma.course.create({
		data: {
			code: "F6-COURSE",
			title: "Routine course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const section = await prisma.section.create({
		data: { offeringId: offering.id, sectionNo: 1 },
	});
	sectionId = section.id;
	await prisma.room.create({
		data: {
			code: "F6-R1",
			building: "F6",
			roomNo: "1",
			type: "CLASSROOM",
			capacity: 40,
		},
	});
	await prisma.timeSlot.create({
		data: {
			label: "08:30-10:00",
			type: "THEORY",
			startMinute: 510,
			endMinute: 600,
		},
	});
	await prisma.dayPattern.create({
		data: { code: "F6-ST", type: "THEORY", days: ["SUN", "TUE"] },
	});
});

it("T-ROUT-07 generation rejects a section without a teacher and lists it", async () => {
	const response = await request(app)
		.post("/api/admin/routines/generate")
		.set("Authorization", authorization())
		.send({ semesterId });
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.sections).toContainEqual({
		sectionId,
		sectionNo: 1,
		courseCode: "F6-COURSE",
	});
	expect(await prisma.generationJob.count()).toBe(0);
});
it("T-ROUT-08 queued generation succeeds and saves draft version 1", async () => {
	await prisma.section.update({
		where: { id: sectionId },
		data: { facultyId: teacher.faculty!.id },
	});
	const response = await request(app)
		.post("/api/admin/routines/generate")
		.set("Authorization", authorization())
		.send({ semesterId });
	expect(response.status).toBe(202);
	expect(response.body.data.jobId).toEqual(expect.any(String));
	const poll = await request(app)
		.get(`/api/admin/jobs/${response.body.data.jobId}`)
		.set("Authorization", authorization());
	expect(poll.status).toBe(200);
	expect(poll.body.data).toMatchObject({
		type: "CLASS_ROUTINE",
		status: "SUCCEEDED",
		progress: 100,
		error: null,
	});
	routineId = poll.body.data.resultId;
	const routine = await prisma.routine.findUniqueOrThrow({
		where: { id: routineId },
		include: { entries: true },
	});
	expect(routine).toMatchObject({ status: "DRAFT", version: 1, score: 0 });
	expect(routine.entries).toHaveLength(1);
	expect(routine.entries[0].sectionId).toBe(sectionId);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.roomId,
	).toBeNull();
});
it("F6 generation and job polling enforce role, phase and pinned source scope", async () => {
	const denied = await request(app)
		.get(`/api/admin/jobs/${crypto.randomUUID()}`)
		.set("Authorization", `Bearer ${tokenFor(teacher)}`);
	expect(denied.status).toBe(403);
	const missing = await request(app)
		.get(`/api/admin/jobs/${crypto.randomUUID()}`)
		.set("Authorization", authorization());
	expect(missing.status).toBe(404);
	const pinned = await request(app)
		.post("/api/admin/routines/generate")
		.set("Authorization", authorization())
		.send({ semesterId, keepPinnedFrom: crypto.randomUUID() });
	expect(pinned.status).toBe(404);
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
	const locked = await request(app)
		.post("/api/admin/routines/generate")
		.set("Authorization", authorization())
		.send({ semesterId });
	expect(locked.status).toBe(409);
	expect(locked.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "PLANNING" },
	});
});
