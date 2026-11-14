import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import { createAdmin, createRegistrationWorld } from "../helpers/factory";

type World = Awaited<ReturnType<typeof createRegistrationWorld>>;
let world: World;
let admin: Awaited<ReturnType<typeof createAdmin>>;
const bearer = (user: Parameters<typeof tokenFor>[0]) =>
	`Bearer ${tokenFor(user)}`;
const adminAuth = () => bearer(admin);
const offeringIds: string[] = [];
let slotIds: string[] = [];
let routineId = "";

async function extraOffering() {
	const course = await prisma.course.create({
		data: {
			code: `EX-${randomUUID().slice(0, 8)}`,
			title: "Extra course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { courseId: course.id, semesterId: world.semester.id },
	});
	const section = await prisma.section.create({
		data: {
			sectionNo: 1,
			offeringId: offering.id,
			facultyId: world.faculty.faculty!.id,
			capacity: 40,
		},
	});
	return { offering, section };
}

async function enroll(
	studentIndex: number,
	section: { id: string; offeringId: string },
) {
	const student = world.students[studentIndex].student!;
	const registration = await prisma.semesterRegistration.upsert({
		where: {
			unique_student_semester: {
				studentId: student.id,
				semesterId: world.semester.id,
			},
		},
		update: {},
		create: {
			studentId: student.id,
			semesterId: world.semester.id,
			paymentDeadline: new Date(Date.now() + 86400000),
		},
	});
	await prisma.enrollment.create({
		data: {
			registrationId: registration.id,
			studentId: student.id,
			sectionId: section.id,
			offeringId: section.offeringId,
			semesterId: world.semester.id,
			credits: 3,
		},
	});
}

async function runJob(jobId: string) {
	const response = await request(app)
		.get(`/api/admin/jobs/${jobId}`)
		.set("Authorization", adminAuth());
	return response.body.data;
}

beforeAll(async () => {
	world = await createRegistrationWorld({ sections: 1, students: 3 });
	admin = await createAdmin();
	await prisma.semester.update({
		where: { id: world.semester.id },
		data: {
			phase: "PLANNING",
			examStartDate: new Date("2026-12-20T00:00:00+06:00"),
			examEndDate: new Date("2026-12-25T00:00:00+06:00"),
		},
	});
	const second = await extraOffering();
	const third = await extraOffering();
	offeringIds.push(world.offering.id, second.offering.id, third.offering.id);
	// A: s1, s2   B: s2, s3   C: s3  (A-B and B-C share students)
	await enroll(0, world.sections[0]);
	await enroll(1, world.sections[0]);
	await enroll(1, second.section);
	await enroll(2, second.section);
	await enroll(2, third.section);
});

describe("exam routine", () => {
	it("T-EXAM-08 overlapping exam slots on one date are refused", async () => {
		const overlap = await request(app)
			.post("/api/admin/exam-slots")
			.set("Authorization", adminAuth())
			.send({
				semesterId: world.semester.id,
				slots: [
					{ date: "2026-12-20", startMinute: 540, endMinute: 660 },
					{ date: "2026-12-20", startMinute: 600, endMinute: 720 },
				],
			});
		expect(overlap.status).toBe(409);
		const outside = await request(app)
			.post("/api/admin/exam-slots")
			.set("Authorization", adminAuth())
			.send({
				semesterId: world.semester.id,
				slots: [{ date: "2027-01-20", startMinute: 540, endMinute: 660 }],
			});
		expect(outside.status).toBe(400);
		const created = await request(app)
			.post("/api/admin/exam-slots")
			.set("Authorization", adminAuth())
			.send({
				semesterId: world.semester.id,
				slots: [
					{ date: "2026-12-20", startMinute: 540, endMinute: 660 },
					{ date: "2026-12-20", startMinute: 700, endMinute: 820 },
					{ date: "2026-12-21", startMinute: 540, endMinute: 660 },
				],
			});
		expect(created.status).toBe(201);
		slotIds = created.body.data.map((slot: { id: string }) => slot.id);
		const again = await request(app)
			.post("/api/admin/exam-slots")
			.set("Authorization", adminAuth())
			.send({
				semesterId: world.semester.id,
				slots: [{ date: "2026-12-20", startMinute: 600, endMinute: 720 }],
			});
		expect(again.status).toBe(409);
	});

	it("T-EXAM-04 generating in PLANNING is refused", async () => {
		const response = await request(app)
			.post("/api/admin/exam-routines/generate")
			.set("Authorization", adminAuth())
			.send({ semesterId: world.semester.id, maxStudentsPerSlot: 10 });
		expect(response.status).toBe(409);
		expect(response.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	});

	it("T-EXAM-05 generate: the job succeeds and the draft holds every course", async () => {
		await prisma.semester.update({
			where: { id: world.semester.id },
			data: { phase: "CLASSES" },
		});
		const response = await request(app)
			.post("/api/admin/exam-routines/generate")
			.set("Authorization", adminAuth())
			.send({ semesterId: world.semester.id, maxStudentsPerSlot: 10 });
		expect(response.status).toBe(202);
		const job = await runJob(response.body.data.jobId);
		expect(job.status).toBe("SUCCEEDED");
		routineId = job.resultId;
		const view = await request(app)
			.get(`/api/admin/exam-routines/${routineId}`)
			.set("Authorization", adminAuth());
		expect(view.status).toBe(200);
		const entries = view.body.data.slots.flatMap(
			(slot: { entries: unknown[] }) => slot.entries,
		);
		expect(entries).toHaveLength(3);
		expect(view.body.data.report.unplaced).toEqual([]);
		const list = await request(app)
			.get("/api/admin/exam-routines")
			.query({ semesterId: world.semester.id })
			.set("Authorization", adminAuth());
		expect(list.body.meta.total).toBe(1);
	});

	it("T-EXAM-06 moving a course into a slot where its students already have an exam is refused", async () => {
		const view = await request(app)
			.get(`/api/admin/exam-routines/${routineId}`)
			.set("Authorization", adminAuth());
		const find = (offeringId: string) => {
			for (const slot of view.body.data.slots)
				for (const entry of slot.entries)
					if (entry.offeringId === offeringId)
						return {
							slotId: slot.id as string,
							entryId: entry.entryId as string,
						};
			throw new Error("entry not found");
		};
		const a = find(offeringIds[0]);
		const b = find(offeringIds[1]);
		const response = await request(app)
			.patch(`/api/admin/exam-routines/${routineId}/entries/${a.entryId}`)
			.set("Authorization", adminAuth())
			.send({ examSlotId: b.slotId });
		expect(response.status).toBe(409);
		expect(response.body.errorDetails.students.length).toBeGreaterThan(0);
	});

	it("T-EXAM-07 publish: offerings get their slot and students see their exams", async () => {
		const response = await request(app)
			.post(`/api/admin/exam-routines/${routineId}/publish`)
			.set("Authorization", adminAuth());
		expect(response.status).toBe(200);
		const offerings = await prisma.courseOffering.findMany({
			where: { id: { in: offeringIds } },
		});
		expect(offerings.every((row) => row.examSlotId)).toBe(true);
		expect(
			(await prisma.examRoutine.findUniqueOrThrow({ where: { id: routineId } }))
				.status,
		).toBe("PUBLISHED");
		const mine = await request(app)
			.get("/api/exam-routines/me")
			.set("Authorization", bearer(world.students[1]));
		expect(mine.status).toBe(200);
		expect(mine.body.data.exams).toHaveLength(2);
		const slots = await request(app)
			.get("/api/exam-slots")
			.query({ semesterId: world.semester.id })
			.set("Authorization", bearer(world.students[1]));
		expect(
			slots.body.data.some(
				(slot: { courses: unknown[] | null }) => slot.courses?.length,
			),
		).toBe(true);
		// a slot used by the published routine cannot be removed
		const used = offerings[0].examSlotId as string;
		const refused = await request(app)
			.delete(`/api/admin/exam-slots/${used}`)
			.set("Authorization", adminAuth());
		expect(refused.status).toBe(409);
		const unused = slotIds.find(
			(id) => !offerings.some((row) => row.examSlotId === id),
		);
		if (unused) {
			const removed = await request(app)
				.delete(`/api/admin/exam-slots/${unused}`)
				.set("Authorization", adminAuth());
			expect(removed.status).toBe(200);
		}
	});
});
