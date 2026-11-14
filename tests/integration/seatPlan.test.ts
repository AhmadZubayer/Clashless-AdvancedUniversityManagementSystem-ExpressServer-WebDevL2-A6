import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { sendExamSeatReminders } from "../../src/app/module/seatPlan/seatPlan.jobs";
import { tokenFor } from "../helpers/auth";
import {
	createAdmin,
	createFaculty,
	createRegistrationWorld,
	createStudent,
} from "../helpers/factory";
import { externalMocks } from "../helpers/mocks";

type World = Awaited<ReturnType<typeof createRegistrationWorld>>;
let world: World;
let admin: Awaited<ReturnType<typeof createAdmin>>;
const bearer = (user: Parameters<typeof tokenFor>[0]) =>
	`Bearer ${tokenFor(user)}`;
const adminAuth = () => bearer(admin);

let slot1 = "";
let slot2 = "";
let plan1 = "";
let plan2 = "";
let routineId = "";
const students1X: Awaited<ReturnType<typeof createStudent>>[] = [];
const students1Y: Awaited<ReturnType<typeof createStudent>>[] = [];
let courseX = "";
let courseY = "";
let offeringY = "";

async function offeringWithStudents(
	label: string,
	count: number,
	into: Awaited<ReturnType<typeof createStudent>>[],
) {
	const course = await prisma.course.create({
		data: {
			code: `${label}-${randomUUID().slice(0, 6)}`,
			title: label,
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
			capacity: 80,
		},
	});
	for (let index = 0; index < count; index++) {
		const user = await createStudent({
			batch: world.batch,
			program: world.program,
		});
		into.push(user);
		await enroll(user, section);
	}
	return { course, offering, section };
}

async function enroll(
	user: Awaited<ReturnType<typeof createStudent>>,
	section: { id: string; offeringId: string },
) {
	const registration = await prisma.semesterRegistration.upsert({
		where: {
			unique_student_semester: {
				studentId: user.student!.id,
				semesterId: world.semester.id,
			},
		},
		update: {},
		create: {
			studentId: user.student!.id,
			semesterId: world.semester.id,
			paymentDeadline: new Date(Date.now() + 86400000),
		},
	});
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
}

beforeAll(async () => {
	world = await createRegistrationWorld({ sections: 1, students: 0 });
	admin = await createAdmin();
	await prisma.semester.update({
		where: { id: world.semester.id },
		data: { phase: "CLASSES" },
	});
	const slotA = await prisma.examSlot.create({
		data: {
			semesterId: world.semester.id,
			date: new Date("2026-12-20T00:00:00.000Z"),
			startMinute: 540,
			endMinute: 660,
		},
	});
	const slotB = await prisma.examSlot.create({
		data: {
			semesterId: world.semester.id,
			date: new Date("2026-12-21T00:00:00.000Z"),
			startMinute: 540,
			endMinute: 660,
		},
	});
	slot1 = slotA.id;
	slot2 = slotB.id;
	const x = await offeringWithStudents("SPX", 6, students1X);
	const y = await offeringWithStudents("SPY", 4, students1Y);
	courseX = x.course.code;
	courseY = y.course.code;
	offeringY = y.offering.id;
	const six: Awaited<ReturnType<typeof createStudent>>[] = [];
	const c = await offeringWithStudents("SPC", 6, six);
	const d = await offeringWithStudents("SPD", 6, six);
	routineId = (
		await prisma.examRoutine.create({
			data: { semesterId: world.semester.id, version: 1 },
		})
	).id;
	await prisma.examRoutineEntry.createMany({
		data: [
			{
				examRoutineId: routineId,
				offeringId: x.offering.id,
				examSlotId: slot1,
			},
			{
				examRoutineId: routineId,
				offeringId: y.offering.id,
				examSlotId: slot1,
			},
			{
				examRoutineId: routineId,
				offeringId: c.offering.id,
				examSlotId: slot2,
			},
			{
				examRoutineId: routineId,
				offeringId: d.offering.id,
				examSlotId: slot2,
			},
		],
	});
	// 8 teachers for the invigilator test
	for (let index = 0; index < 8; index++)
		await createFaculty(world.department.id);
});

const post = (path: string, body: object = {}) =>
	request(app).post(path).set("Authorization", adminAuth()).send(body);

describe("seat plan", () => {
	it("T-SEAT-07 creating a seat plan before the exam routine is published is refused", async () => {
		const early = await post("/api/admin/seat-plans", { examSlotId: slot1 });
		expect(early.status).toBe(409);
		await prisma.$transaction([
			prisma.examRoutine.update({
				where: { id: routineId },
				data: { status: "PUBLISHED", publishedAt: new Date() },
			}),
			...(
				await prisma.examRoutineEntry.findMany({
					where: { examRoutineId: routineId },
				})
			).map((entry) =>
				prisma.courseOffering.update({
					where: { id: entry.offeringId },
					data: { examSlotId: entry.examSlotId },
				}),
			),
		]);
		const created = await post("/api/admin/seat-plans", { examSlotId: slot1 });
		expect(created.status).toBe(201);
		plan1 = created.body.data.id;
		const again = await post("/api/admin/seat-plans", { examSlotId: slot1 });
		expect(again.status).toBe(409);
		const second = await post("/api/admin/seat-plans", { examSlotId: slot2 });
		plan2 = second.body.data.id;
		const overview = await request(app)
			.get("/api/admin/seat-plans")
			.query({ semesterId: world.semester.id })
			.set("Authorization", adminAuth());
		expect(overview.body.data).toHaveLength(2);
		expect(overview.body.data[0].seatPlanStatus).toBe("DRAFT");
	});

	it("T-SEAT-08 generate, summary, publish and my seats", async () => {
		const rooms = await request(app)
			.put(`/api/admin/seat-plans/${plan1}/rooms`)
			.set("Authorization", adminAuth())
			.send({
				rooms: [{ roomNo: "301", totalSeats: 20, seatsPerColumn: 4 }],
			});
		expect(rooms.status).toBe(200);
		expect(rooms.body.data.students).toBe(10);
		expect(rooms.body.data.oddSeats).toBe(12);
		expect(rooms.body.data.evenSeats).toBe(8);
		const generated = await post(`/api/admin/seat-plans/${plan1}/generate`, {
			orderBy: "STUDENT_ID",
		});
		expect(generated.status).toBe(200);
		expect(generated.body.data.validation.ok).toBe(true);
		const summary = await request(app)
			.get(`/api/admin/seat-plans/${plan1}`)
			.set("Authorization", adminAuth());
		expect(summary.body.data.seated).toBe(10);
		expect(summary.body.data.unseated).toEqual([]);
		expect(summary.body.data.validation.ok).toBe(true);
		const mails = externalMocks.emails.length;
		const published = await post(`/api/admin/seat-plans/${plan1}/publish`);
		expect(published.status).toBe(200);
		expect(externalMocks.emails.length - mails).toBe(10);
		const mine = await request(app)
			.get("/api/seat-plans/me")
			.set("Authorization", bearer(students1X[0]));
		expect(mine.status).toBe(200);
		expect(mine.body.data).toHaveLength(1);
		expect(mine.body.data[0].roomNo).toBe("301");
		expect(mine.body.data[0].column).toBe(1);
		expect(mine.body.data[0].seatNo).toBeGreaterThan(0);
		const grid = await request(app)
			.get(`/api/seat-plans/${plan1}/rooms/${summary.body.data.rooms[0].id}`)
			.set("Authorization", adminAuth());
		expect(grid.status).toBe(200);
		expect(grid.body.data.columns).toHaveLength(5);
		const teacher = await createFaculty(world.department.id);
		const denied = await request(app)
			.get(`/api/seat-plans/${plan1}/rooms/${summary.body.data.rooms[0].id}`)
			.set("Authorization", bearer(teacher));
		expect(denied.status).toBe(403);
	}, 90000);

	it("T-SEAT-09 a swap that puts the same course side by side is refused", async () => {
		const seats = await prisma.seatAssignment.findMany({
			where: { seatPlanId: plan1 },
		});
		const find = (column: number, seatNo: number) =>
			seats.find((row) => row.column === column && row.seatNo === seatNo)!;
		const response = await post(`/api/admin/seat-plans/${plan1}/swap`, {
			seatAId: find(1, 2).id,
			seatBId: find(2, 1).id,
		});
		expect(response.status).toBe(409);
		expect(response.body.errorDetails.code).toBe("HARD_RULE_VIOLATION");
		// a harmless swap inside column 1 works and is audit-logged
		const ok = await post(`/api/admin/seat-plans/${plan1}/swap`, {
			seatAId: find(1, 1).id,
			seatBId: find(1, 2).id,
		});
		expect(ok.status).toBe(200);
		expect(
			await prisma.auditLog.count({
				where: { entityId: plan1, action: "SEAT_SWAPPED" },
			}),
		).toBe(1);
	});

	it("T-SEAT-10 a late student gets a valid empty seat", async () => {
		const late = await createStudent({
			batch: world.batch,
			program: world.program,
		});
		const section = await prisma.section.findFirstOrThrow({
			where: { offeringId: offeringY },
		});
		await enroll(late, section);
		const response = await post(`/api/admin/seat-plans/${plan1}/students`, {
			studentId: late.student!.id,
		});
		expect(response.status).toBe(201);
		const summary = await request(app)
			.get(`/api/admin/seat-plans/${plan1}`)
			.set("Authorization", adminAuth());
		expect(summary.body.data.seated).toBe(11);
		expect(summary.body.data.validation.ok).toBe(true);
	});

	it("T-SEAT-11 auto-assign invigilators: two per room and nobody in two rooms", async () => {
		await request(app)
			.put(`/api/admin/seat-plans/${plan2}/rooms`)
			.set("Authorization", adminAuth())
			.send({
				rooms: [
					{ roomNo: "401", totalSeats: 4, seatsPerColumn: 2 },
					{ roomNo: "402", totalSeats: 4, seatsPerColumn: 2 },
					{ roomNo: "403", totalSeats: 4, seatsPerColumn: 2 },
				],
			});
		const generated = await post(`/api/admin/seat-plans/${plan2}/generate`, {});
		expect(generated.status).toBe(200);
		const assigned = await post(
			`/api/admin/seat-plans/${plan2}/invigilators/auto-assign`,
		);
		expect(assigned.status).toBe(200);
		const rows = await prisma.invigilatorAssignment.findMany({
			where: { seatPlanId: plan2 },
		});
		expect(rows).toHaveLength(6);
		expect(new Set(rows.map((row) => row.facultyId)).size).toBe(6);
		const perRoom = new Map<string, number>();
		for (const row of rows)
			perRoom.set(
				row.seatPlanRoomId,
				(perRoom.get(row.seatPlanRoomId) ?? 0) + 1,
			);
		expect([...perRoom.values()]).toEqual([2, 2, 2]);
		// by hand: a teacher from another room is refused
		const [first, second] = rows.filter(
			(row) =>
				row.seatPlanRoomId !== rows[0].seatPlanRoomId || row.id === rows[0].id,
		);
		const clash = await request(app)
			.put(
				`/api/admin/seat-plans/${plan2}/rooms/${first.seatPlanRoomId}/invigilators`,
			)
			.set("Authorization", adminAuth())
			.send({
				facultyIds: [
					first.facultyId,
					rows.find((row) => row.seatPlanRoomId !== first.seatPlanRoomId)!
						.facultyId,
				],
			});
		expect(clash.status).toBe(409);
		expect(second).toBeDefined();
	});

	it("T-SEAT-12 door and attendance sheets are PDFs", async () => {
		for (const type of ["door", "attendance", "full"]) {
			const response = await request(app)
				.get(`/api/admin/seat-plans/${plan1}/export`)
				.query({ type })
				.set("Authorization", adminAuth())
				.buffer(true)
				.parse((res, done) => {
					const chunks: Buffer[] = [];
					res.on("data", (chunk: Buffer) => chunks.push(chunk));
					res.on("end", () => done(null, Buffer.concat(chunks)));
				});
			expect(response.status).toBe(200);
			expect(response.headers["content-type"]).toContain("application/pdf");
			expect((response.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
		}
	});

	it("T-JOB-06 the reminder emails only students with an exam tomorrow, with their seat", async () => {
		const tomorrow = new Date(Date.now() + 6 * 3600000 + 24 * 3600000)
			.toISOString()
			.slice(0, 10);
		await prisma.examSlot.update({
			where: { id: slot1 },
			data: { date: new Date(`${tomorrow}T00:00:00.000Z`) },
		});
		const start = externalMocks.emails.length;
		const result = await sendExamSeatReminders();
		expect(result.sent).toBe(11);
		const mails = externalMocks.emails.slice(start);
		expect(mails).toHaveLength(11);
		const mail = mails.find((item) => item.to === students1X[0].student!.email);
		expect(mail?.templateData.roomNo).toBe("301");
		expect(mail?.templateData.column).toBeDefined();
		expect(mail?.templateData.seatNo).toBeDefined();
		// courses X and Y only: nobody from the unpublished slot is emailed
		expect(courseX && courseY).toBeTruthy();
	});
});
