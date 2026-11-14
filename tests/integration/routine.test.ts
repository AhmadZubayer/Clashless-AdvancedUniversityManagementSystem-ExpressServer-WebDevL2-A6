import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import {
	createAcademicWorld,
	createAdmin,
	createFaculty,
	createStudent,
} from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createAdmin>>;
let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let teacher: Awaited<ReturnType<typeof createFaculty>>;
let semesterId: string;
let sectionId: string;
let routineId: string;
let secondRoutineId: string;
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

it("F6 lists versions, filters views and reports fresh hard-rule violations", async () => {
	const list = await request(app)
		.get(`/api/admin/routines?semesterId=${semesterId}`)
		.set("Authorization", authorization());
	expect(list.status).toBe(200);
	expect(list.body.data[0]).toMatchObject({
		id: routineId,
		version: 1,
		status: "DRAFT",
		score: 0,
		entryCount: 1,
		unplacedCount: 0,
	});
	expect(list.body.meta.total).toBe(1);
	const view = await request(app)
		.get(
			`/api/admin/routines/${routineId}?view=faculty&facultyId=${teacher.faculty!.id}`,
		)
		.set("Authorization", authorization());
	expect(view.status).toBe(200);
	expect(view.body.data.entries).toHaveLength(1);
	expect(view.body.data.entries[0].section.faculty).not.toHaveProperty("user");
	const filtered = await request(app)
		.get(
			`/api/admin/routines/${routineId}?view=room&roomId=${crypto.randomUUID()}`,
		)
		.set("Authorization", authorization());
	expect(filtered.status).toBe(200);
	expect(filtered.body.data.entries).toEqual([]);
	const invalid = await request(app)
		.get(`/api/admin/routines/${routineId}?view=program`)
		.set("Authorization", authorization());
	expect(invalid.status).toBe(400);
	const first = await request(app)
		.get(`/api/admin/routines/${routineId}/report`)
		.set("Authorization", authorization());
	expect(first.status).toBe(200);
	expect(first.body.data).toMatchObject({
		score: 0,
		unplaced: [],
		validation: { ok: true, violations: [] },
	});
	const roomId = view.body.data.entries[0].roomId;
	await prisma.room.update({ where: { id: roomId }, data: { capacity: 20 } });
	const stale = await request(app)
		.get(`/api/admin/routines/${routineId}/report`)
		.set("Authorization", authorization());
	expect(stale.status).toBe(200);
	expect(stale.body.data.validation.ok).toBe(false);
	expect(stale.body.data.validation.violations[0].code).toBe(
		"ROOM_INCOMPATIBLE",
	);
	await prisma.room.update({ where: { id: roomId }, data: { capacity: 40 } });
});

it("T-ROUT-09 a room clash is rejected atomically; valid moves and swaps recompute the score", async () => {
	const first = await prisma.routineEntry.findFirstOrThrow({
		where: { routineId },
	});
	const section = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const otherTeacher = await createFaculty(world.department.id);
	const second = await prisma.section.create({
		data: {
			offeringId: section.offeringId,
			sectionNo: 2,
			facultyId: otherTeacher.faculty!.id,
		},
	});
	const room = await prisma.room.create({
		data: {
			code: "F6-R2",
			building: "F6",
			roomNo: "2",
			type: "CLASSROOM",
			capacity: 40,
		},
	});
	const entry = await prisma.routineEntry.create({
		data: {
			routineId,
			sectionId: second.id,
			roomId: room.id,
			dayPatternId: first.dayPatternId,
			timeSlotId: first.timeSlotId,
		},
	});
	const conflict = await request(app)
		.patch(`/api/admin/routines/${routineId}/entries/${entry.id}`)
		.set("Authorization", authorization())
		.send({ roomId: first.roomId });
	expect(conflict.status).toBe(409);
	expect(conflict.body.errorDetails.code).toBe("HARD_RULE_VIOLATION");
	expect(conflict.body.message).toContain("F6-R1");
	expect(
		(await prisma.routineEntry.findUniqueOrThrow({ where: { id: entry.id } }))
			.roomId,
	).toBe(room.id);
	const slot = await prisma.timeSlot.create({
		data: {
			label: "10:10-11:40",
			type: "THEORY",
			startMinute: 610,
			endMinute: 700,
		},
	});
	const moved = await request(app)
		.patch(`/api/admin/routines/${routineId}/entries/${entry.id}`)
		.set("Authorization", authorization())
		.send({ timeSlotId: slot.id });
	expect(moved.status).toBe(200);
	expect(moved.body.data).toMatchObject({
		score: 0,
		violations: [],
		entry: { timeSlotId: slot.id },
	});
	const swap = await request(app)
		.post(`/api/admin/routines/${routineId}/entries/swap`)
		.set("Authorization", authorization())
		.send({ entryAId: first.id, entryBId: entry.id });
	expect(swap.status).toBe(200);
	expect(swap.body.data.entries[0]).toMatchObject({
		id: first.id,
		roomId: room.id,
		timeSlotId: slot.id,
	});
	expect(swap.body.data.entries[1]).toMatchObject({
		id: entry.id,
		roomId: first.roomId,
		timeSlotId: first.timeSlotId,
	});
	expect(swap.body.data.violations).toEqual([]);
});

it("T-ROUT-10 pinning and regenerating preserves the exact pinned placement in version 2", async () => {
	const entry = await prisma.routineEntry.findFirstOrThrow({
		where: { routineId, sectionId },
	});
	const pinned = await request(app)
		.patch(`/api/admin/routines/${routineId}/entries/${entry.id}/pin`)
		.set("Authorization", authorization());
	expect(pinned.status).toBe(200);
	expect(pinned.body.data.isPinned).toBe(true);
	const response = await request(app)
		.post("/api/admin/routines/generate")
		.set("Authorization", authorization())
		.send({ semesterId, keepPinnedFrom: routineId });
	expect(response.status).toBe(202);
	const job = await prisma.generationJob.findUniqueOrThrow({
		where: { id: response.body.data.jobId },
	});
	expect(job.status).toBe("SUCCEEDED");
	secondRoutineId = job.resultId!;
	const version = await prisma.routine.findUniqueOrThrow({
		where: { id: secondRoutineId },
		include: { entries: true },
	});
	expect(version.version).toBe(2);
	expect(version.entries).toHaveLength(2);
	expect(
		version.entries.find((row) => row.sectionId === sectionId),
	).toMatchObject({
		isPinned: true,
		roomId: entry.roomId,
		dayPatternId: entry.dayPatternId,
		timeSlotId: entry.timeSlotId,
	});
});

it("T-ROUT-12 publication rejects missing sections even when the saved report claims none", async () => {
	const entry = await prisma.routineEntry.findFirstOrThrow({
		where: { routineId },
	});
	const incomplete = await prisma.routine.create({
		data: {
			semesterId,
			version: 3,
			report: { unplaced: [] },
			entries: {
				create: {
					sectionId: entry.sectionId,
					roomId: entry.roomId,
					dayPatternId: entry.dayPatternId,
					timeSlotId: entry.timeSlotId,
				},
			},
		},
	});
	const response = await request(app)
		.post(`/api/admin/routines/${incomplete.id}/publish`)
		.set("Authorization", authorization());
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.unplaced).toHaveLength(1);
	expect(
		(await prisma.routine.findUniqueOrThrow({ where: { id: incomplete.id } }))
			.status,
	).toBe("DRAFT");
});

it("T-ROUT-11 publication copies schedules and archives the previous published version", async () => {
	for (const id of [routineId, secondRoutineId]) {
		const response = await request(app)
			.post(`/api/admin/routines/${id}/publish`)
			.set("Authorization", authorization());
		expect(response.status).toBe(200);
		expect(response.body.data.status).toBe("PUBLISHED");
		expect(response.body.data.publishedAt).toEqual(expect.any(String));
	}
	expect(
		(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } }))
			.status,
	).toBe("ARCHIVED");
	expect(
		await prisma.routine.count({ where: { semesterId, status: "PUBLISHED" } }),
	).toBe(1);
	const entries = await prisma.routineEntry.findMany({
		where: { routineId: secondRoutineId },
	});
	for (const entry of entries) {
		const section = await prisma.section.findUniqueOrThrow({
			where: { id: entry.sectionId },
		});
		expect(section).toMatchObject({
			roomId: entry.roomId,
			dayPatternId: entry.dayPatternId,
			timeSlotId: entry.timeSlotId,
		});
	}
	const pin = await request(app)
		.patch(
			`/api/admin/routines/${secondRoutineId}/entries/${entries[0].id}/pin`,
		)
		.set("Authorization", authorization());
	expect(pin.status).toBe(409);
});

it("T-ROUT-13 teacher weekly grid contains only their own sections", async () => {
	const response = await request(app)
		.get("/api/routines/me")
		.set("Authorization", `Bearer ${tokenFor(teacher)}`);
	expect(response.status).toBe(200);
	expect(
		response.body.data.entries.map(
			(row: { sectionId: string }) => row.sectionId,
		),
	).toEqual([sectionId]);
	const values = Object.values(response.body.data.grid).flatMap((day) =>
		Object.values(day as Record<string, { sectionId: string }[]>).flat(),
	);
	expect(values).toHaveLength(2);
	expect(values.every((entry) => entry.sectionId === sectionId)).toBe(true);
});

it("F6 published filters, enrolled student grids and scoped PDF exports", async () => {
	const student = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const section = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const registration = await prisma.semesterRegistration.create({
		data: {
			semesterId,
			studentId: student.student!.id,
			paymentDeadline: new Date(Date.now() + 86400000),
		},
	});
	await prisma.enrollment.create({
		data: {
			semesterId,
			studentId: student.student!.id,
			registrationId: registration.id,
			sectionId,
			offeringId: section.offeringId,
			credits: 3,
		},
	});
	const mine = await request(app)
		.get("/api/routines/me")
		.set("Authorization", `Bearer ${tokenFor(student)}`);
	expect(mine.status).toBe(200);
	expect(
		mine.body.data.entries.map((row: { sectionId: string }) => row.sectionId),
	).toEqual([sectionId]);
	const published = await request(app)
		.get(
			`/api/routines/published?semesterId=${semesterId}&facultyId=${teacher.faculty!.id}`,
		)
		.set("Authorization", `Bearer ${tokenFor(student)}`);
	expect(published.status).toBe(200);
	expect(published.body.data.entries).toHaveLength(1);
	const empty = await request(app)
		.get(
			`/api/routines/published?semesterId=${semesterId}&departmentId=${crypto.randomUUID()}`,
		)
		.set("Authorization", authorization());
	expect(empty.status).toBe(200);
	expect(empty.body.data.entries).toEqual([]);
	const pdf = await request(app)
		.get("/api/routines/published/export?view=faculty")
		.set("Authorization", `Bearer ${tokenFor(teacher)}`);
	expect(pdf.status).toBe(200);
	expect(pdf.headers["content-type"]).toContain("application/pdf");
	expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
	const forbidden = await request(app)
		.get("/api/routines/published/export?view=master")
		.set("Authorization", `Bearer ${tokenFor(teacher)}`);
	expect(forbidden.status).toBe(403);
	const other = await request(app)
		.get(
			`/api/routines/published/export?view=faculty&facultyId=${crypto.randomUUID()}`,
		)
		.set("Authorization", `Bearer ${tokenFor(teacher)}`);
	expect(other.status).toBe(403);
	const version = await request(app)
		.get(`/api/admin/routines/${routineId}/export?view=master`)
		.set("Authorization", authorization());
	expect(version.status).toBe(200);
	expect(version.body.subarray(0, 4).toString()).toBe("%PDF");
	const denied = await request(app)
		.get(`/api/admin/routines/${routineId}/export`)
		.set("Authorization", `Bearer ${tokenFor(teacher)}`);
	expect(denied.status).toBe(403);
});
