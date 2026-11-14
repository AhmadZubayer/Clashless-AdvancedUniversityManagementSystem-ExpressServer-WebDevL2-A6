import request from "supertest";
import { beforeAll, beforeEach, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import { externalMocks } from "../helpers/mocks";
import {
	createAcademicWorld,
	createAdmin,
	createFaculty,
	createStudent,
} from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createAdmin>>;
let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let semesterId: string;
let courseId: string;
let offeringId: string;
const authorization = () => `Bearer ${tokenFor(admin)}`;

beforeAll(async () => {
	admin = await createAdmin();
	world = await createAcademicWorld();
	const semester = await prisma.semester.create({
		data: { code: "F5-PLANNING", name: "Section tests" },
	});
	semesterId = semester.id;
	const course = await prisma.course.create({
		data: {
			code: "CSE215",
			title: "Section test course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	courseId = course.id;
});
it("T-SEC-01 offering creates sections 1 through 10 with default capacity 40", async () => {
	const response = await request(app)
		.post("/api/admin/offerings")
		.set("Authorization", authorization())
		.send({ semesterId, courseId, sectionCount: 10 });
	expect(response.status).toBe(201);
	offeringId = response.body.data.id;
	expect(
		response.body.data.sections.map(
			(section: { sectionNo: number }) => section.sectionNo,
		),
	).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	expect(
		response.body.data.sections.every(
			(section: { capacity: number; enrolledCount: number }) =>
				section.capacity === 40 && section.enrolledCount === 0,
		),
	).toBe(true);
	const list = await request(app)
		.get(
			`/api/offerings?semesterId=${semesterId}&departmentId=${world.department.id}&searchTerm=CSE215`,
		)
		.set("Authorization", authorization());
	expect(list.status).toBe(200);
	expect(list.body.data[0].sections).toHaveLength(10);
	expect(list.body.meta.total).toBe(1);
});
it("T-SEC-02 duplicate course offering in one semester is rejected", async () => {
	expect(
		(
			await request(app)
				.post("/api/admin/offerings")
				.set("Authorization", authorization())
				.send({ semesterId, courseId, sectionCount: 1 })
		).status,
	).toBe(409);
});
it("F5 offering removal deletes sections and respects PLANNING", async () => {
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
	const forbidden = await request(app)
		.delete(`/api/admin/offerings/${offeringId}`)
		.set("Authorization", authorization());
	expect(forbidden.status).toBe(409);
	expect(forbidden.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "PLANNING" },
	});
	expect(
		(
			await request(app)
				.delete(`/api/admin/offerings/${offeringId}`)
				.set("Authorization", authorization())
		).status,
	).toBe(200);
	expect(await prisma.section.count({ where: { offeringId } })).toBe(0);
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "CLOSED" },
	});
});

async function scheduledWorld() {
	const semester = await prisma.semester.create({
		data: { code: `F5-${crypto.randomUUID()}`, name: "Scheduled semester" },
	});
	const teacher = await createFaculty(world.department.id);
	const otherTeacher = await createFaculty(world.department.id);
	const course = await prisma.course.create({
		data: {
			code: `F5-${crypto.randomUUID()}`,
			title: "Other course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { courseId, semesterId: semester.id },
	});
	const otherOffering = await prisma.courseOffering.create({
		data: { courseId: course.id, semesterId: semester.id },
	});
	const room = await prisma.room.create({
		data: {
			code: `F5-${crypto.randomUUID()}`,
			building: "Test",
			roomNo: "1",
			type: "CLASSROOM",
			capacity: 80,
		},
	});
	const otherRoom = await prisma.room.create({
		data: {
			code: `F5-${crypto.randomUUID()}`,
			building: "Test",
			roomNo: "2",
			type: "CLASSROOM",
			capacity: 80,
		},
	});
	const pattern = await prisma.dayPattern.upsert({
		where: { code: "F5-ST" },
		create: { code: "F5-ST", type: "THEORY", days: ["SUN", "TUE"] },
		update: {},
	});
	const slot = await prisma.timeSlot.upsert({
		where: { unique_time_slot: { type: "THEORY", startMinute: 510 } },
		create: {
			type: "THEORY",
			label: "08:30â€“10:00",
			startMinute: 510,
			endMinute: 600,
		},
		update: {},
	});
	const nextSlot = await prisma.timeSlot.upsert({
		where: { unique_time_slot: { type: "THEORY", startMinute: 600 } },
		create: {
			type: "THEORY",
			label: "10:00â€“11:30",
			startMinute: 600,
			endMinute: 690,
		},
		update: {},
	});
	const section = await prisma.section.create({
		data: {
			offeringId: offering.id,
			sectionNo: 1,
			facultyId: teacher.faculty!.id,
			roomId: room.id,
			dayPatternId: pattern.id,
			timeSlotId: slot.id,
		},
	});
	const other = await prisma.section.create({
		data: {
			offeringId: otherOffering.id,
			sectionNo: 1,
			facultyId: otherTeacher.faculty!.id,
			roomId: otherRoom.id,
			dayPatternId: pattern.id,
			timeSlotId: nextSlot.id,
		},
	});
	const routine = await prisma.routine.create({
		data: {
			semesterId: semester.id,
			version: 1,
			status: "PUBLISHED",
			entries: {
				create: [
					{
						sectionId: section.id,
						roomId: room.id,
						dayPatternId: pattern.id,
						timeSlotId: slot.id,
					},
					{
						sectionId: other.id,
						roomId: otherRoom.id,
						dayPatternId: pattern.id,
						timeSlotId: nextSlot.id,
					},
				],
			},
		},
	});
	return {
		semester,
		teacher,
		otherTeacher,
		offering,
		section,
		other,
		room,
		otherRoom,
		pattern,
		slot,
		nextSlot,
		routine,
	};
}

async function enroll(
	fixture: Awaited<ReturnType<typeof scheduledWorld>>,
	both = false,
) {
	const user = await createStudent({
		program: world.program,
		batch: world.batch,
	});
	const registration = await prisma.semesterRegistration.create({
		data: {
			studentId: user.student!.id,
			semesterId: fixture.semester.id,
			paymentDeadline: new Date(Date.now() + 86400000),
			totalCredits: both ? 6 : 3,
			totalFee: both ? 51000 : 31500,
			paidAmount: 40000,
		},
	});
	for (const section of both
		? [fixture.section, fixture.other]
		: [fixture.section]) {
		await prisma.enrollment.create({
			data: {
				studentId: user.student!.id,
				semesterId: fixture.semester.id,
				registrationId: registration.id,
				sectionId: section.id,
				offeringId: section.offeringId,
				credits: 3,
			},
		});
		await prisma.section.update({
			where: { id: section.id },
			data: { enrolledCount: { increment: 1 } },
		});
	}
	return { user, registration };
}

it("T-SEC-03 bulk assignment rejects 15 credits against a 12-credit limit without partial writes", async () => {
	const fixture = preparedWorld;
	const sections = [fixture.section];
	for (let index = 2; index <= 5; index++)
		sections.push(
			await prisma.section.create({
				data: { offeringId: fixture.offering.id, sectionNo: index },
			}),
		);
	const response = await request(app)
		.put("/api/admin/sections/faculty-assignments")
		.set("Authorization", authorization())
		.send({
			semesterId: fixture.semester.id,
			assignments: sections.map((row) => ({
				sectionId: row.id,
				facultyId: fixture.teacher.faculty!.id,
			})),
		});
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.totalCredits).toBe("15");
	const unchanged = await prisma.section.findMany({
		where: { id: { in: sections.slice(1).map((row) => row.id) } },
	});
	expect(unchanged.every((row) => row.facultyId === null)).toBe(true);
});

it("F5 bulk teacher swaps use final loads and mine returns only current assigned sections", async () => {
	const fixture = preparedWorld;
	const response = await request(app)
		.put("/api/admin/sections/faculty-assignments")
		.set("Authorization", authorization())
		.send({
			semesterId: fixture.semester.id,
			assignments: [
				{
					sectionId: fixture.section.id,
					facultyId: fixture.otherTeacher.faculty!.id,
				},
				{ sectionId: fixture.other.id, facultyId: fixture.teacher.faculty!.id },
			],
		});
	expect(response.status).toBe(200);
	const mine = await request(app)
		.get("/api/sections/mine")
		.set("Authorization", `Bearer ${tokenFor(fixture.teacher)}`);
	expect(mine.status).toBe(200);
	expect(mine.body.data.map((row: { id: string }) => row.id)).toEqual([
		fixture.other.id,
	]);
	expect(mine.body.data[0].enrolledCount).toBe(0);
});

it("T-SEC-04 capacity cannot be reduced below enrolledCount", async () => {
	const fixture = preparedWorld;

	const response = await request(app)
		.patch(`/api/admin/sections/${fixture.section.id}`)
		.set("Authorization", authorization())
		.send({ capacity: 1 });
	expect(response.status).toBe(409);
	expect(
		(
			await prisma.section.findUniqueOrThrow({
				where: { id: fixture.section.id },
			})
		).capacity,
	).toBe(40);
});

it("T-SEC-10 preferences cannot change after even a draft routine version exists", async () => {
	const fixture = preparedWorld;
	await prisma.routine.update({
		where: { id: fixture.routine.id },
		data: { status: "DRAFT" },
	});
	const response = await request(app)
		.put("/api/faculty-preferences/me")
		.set("Authorization", `Bearer ${tokenFor(fixture.teacher)}`)
		.send({
			semesterId: fixture.semester.id,
			items: [{ day: "SUN", timeSlotId: fixture.slot.id, kind: "PREFERRED" }],
		});
	expect(response.status).toBe(409);
	expect(
		await prisma.facultySlotPreference.count({
			where: { semesterId: fixture.semester.id },
		}),
	).toBe(0);
});

it("F5 teacher preferences replace, scope, validate and clear before generation", async () => {
	const fixture = preparedWorld;
	await prisma.routine.delete({ where: { id: fixture.routine.id } });
	const teacherToken = `Bearer ${tokenFor(fixture.teacher)}`;
	const items = [
		{ day: "SUN", timeSlotId: fixture.slot.id, kind: "PREFERRED" },
		{ day: "TUE", timeSlotId: fixture.nextSlot.id, kind: "UNAVAILABLE" },
	];
	const save = await request(app)
		.put("/api/faculty-preferences/me")
		.set("Authorization", teacherToken)
		.send({ semesterId: fixture.semester.id, items });
	expect(save.status).toBe(200);
	expect(save.body.data).toHaveLength(2);
	const other = await request(app)
		.get(
			`/api/faculty-preferences/me?semesterId=${fixture.semester.id}&facultyId=${fixture.teacher.faculty!.id}`,
		)
		.set("Authorization", `Bearer ${tokenFor(fixture.otherTeacher)}`);
	expect(other.status).toBe(200);
	expect(other.body.data).toHaveLength(0);
	const own = await request(app)
		.get(`/api/faculty-preferences/me?semesterId=${fixture.semester.id}`)
		.set("Authorization", teacherToken);
	expect(own.body.meta.total).toBe(2);
	const all = await request(app)
		.get(
			`/api/admin/faculty-preferences?semesterId=${fixture.semester.id}&facultyId=${fixture.teacher.faculty!.id}`,
		)
		.set("Authorization", authorization());
	expect(all.status).toBe(200);
	expect(all.body.meta.total).toBe(2);
	const duplicate = await request(app)
		.put("/api/faculty-preferences/me")
		.set("Authorization", teacherToken)
		.send({ semesterId: fixture.semester.id, items: [items[0], items[0]] });
	expect(duplicate.status).toBe(400);
	expect(
		await prisma.facultySlotPreference.count({
			where: { semesterId: fixture.semester.id },
		}),
	).toBe(2);
	const clear = await request(app)
		.put("/api/faculty-preferences/me")
		.set("Authorization", teacherToken)
		.send({ semesterId: fixture.semester.id, items: [] });
	expect(clear.status).toBe(200);
	expect(clear.body.data).toEqual([]);
	await prisma.semester.update({
		where: { id: fixture.semester.id },
		data: { phase: "REGISTRATION" },
	});
	const locked = await request(app)
		.put("/api/faculty-preferences/me")
		.set("Authorization", teacherToken)
		.send({ semesterId: fixture.semester.id, items });
	expect(locked.status).toBe(409);
	expect(locked.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
});

it("T-SEC-08 another teacher cannot open a section class list", async () => {
	const fixture = preparedWorld;
	const response = await request(app)
		.get(`/api/sections/${fixture.section.id}/students`)
		.set("Authorization", `Bearer ${tokenFor(fixture.otherTeacher)}`);
	expect(response.status).toBe(403);
});

it("T-SEC-09 CSV has one row per ENROLLED student ordered by university ID; JSON and PDF work", async () => {
	const fixture = preparedWorld;
	const users = preparedEnrollments.map((row) => row.user);
	await prisma.student.update({
		where: { id: users[0].student!.id },
		data: { name: 'A, "quoted" student' },
	});
	await prisma.enrollment.update({
		where: {
			unique_student_section: {
				studentId: users[1].student!.id,
				sectionId: fixture.section.id,
			},
		},
		data: { status: "DROPPED" },
	});
	const expectedIds = [
		users[0].student!.universityId,
		users[2].student!.universityId,
	].sort();
	const csv = await request(app)
		.get(`/api/sections/${fixture.section.id}/students?format=csv`)
		.set("Authorization", `Bearer ${tokenFor(fixture.teacher)}`);
	expect(csv.status).toBe(200);
	expect(csv.headers["content-type"]).toContain("text/csv");
	const lines = csv.text.trim().split("\r\n");
	expect(lines).toHaveLength(3);
	expect(lines.slice(1).map((line) => line.split(",")[0])).toEqual(
		expectedIds.map((id) => `"${id}"`),
	);
	expect(csv.text).toContain('"A, ""quoted"" student"');
	const json = await request(app)
		.get(`/api/sections/${fixture.section.id}/students`)
		.set("Authorization", authorization());
	expect(json.status).toBe(200);
	expect(
		json.body.data.map((row: { universityId: string }) => row.universityId),
	).toEqual(expectedIds);
	expect(
		json.body.data.every(
			(row: Record<string, unknown>) =>
				!("password" in row) && !("user" in row),
		),
	).toBe(true);
	const pdf = await request(app)
		.get(`/api/sections/${fixture.section.id}/students?format=pdf`)
		.set("Authorization", authorization());
	expect(pdf.status).toBe(200);
	expect(pdf.headers["content-type"]).toContain("application/pdf");
	expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
});

it("T-SEC-05 an extra section cannot double-book a published room", async () => {
	const fixture = preparedWorld;
	const response = await request(app)
		.post("/api/admin/sections")
		.set("Authorization", authorization())
		.send({
			offeringId: fixture.offering.id,
			roomId: fixture.room.id,
			dayPatternId: fixture.pattern.id,
			timeSlotId: fixture.slot.id,
		});
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("HARD_RULE_VIOLATION");
	expect(response.body.message).toContain(fixture.room.code);
	expect(
		await prisma.section.count({ where: { offeringId: fixture.offering.id } }),
	).toBe(1);
});

it("T-SEC-06 student clash prevents rescheduling and lists the affected student", async () => {
	const fixture = preparedWorld;
	const { user } = preparedEnrollments[0];
	const response = await request(app)
		.patch(`/api/admin/sections/${fixture.section.id}/schedule`)
		.set("Authorization", authorization())
		.send({
			roomId: fixture.room.id,
			dayPatternId: fixture.pattern.id,
			timeSlotId: fixture.nextSlot.id,
			reason: "Move class",
		});
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.students).toContainEqual({
		studentId: user.student!.id,
		universityId: user.student!.universityId,
	});
	expect(
		(
			await prisma.section.findUniqueOrThrow({
				where: { id: fixture.section.id },
			})
		).timeSlotId,
	).toBe(fixture.slot.id);
});

it("T-SEC-07 cancellation reduces three bills, preserves credit and notifies students", async () => {
	const fixture = preparedWorld;
	const students = preparedEnrollments;
	const response = await request(app)
		.post(`/api/admin/sections/${fixture.section.id}/cancel`)
		.set("Authorization", authorization())
		.send({ reason: "Low demand" });
	expect(response.status).toBe(200);
	expect(response.body.data).toMatchObject({
		status: "CANCELLED",
		enrolledCount: 0,
	});
	const rows = await prisma.enrollment.findMany({
		where: { sectionId: fixture.section.id },
	});
	expect(rows).toHaveLength(3);
	expect(rows.every((row) => row.status === "CANCELLED")).toBe(true);
	for (const [index, { registration, user }] of students.entries()) {
		const bill = await prisma.semesterRegistration.findUniqueOrThrow({
			where: { id: registration.id },
		});
		expect(bill.totalCredits.toString()).toBe(index === 0 ? "3" : "0");
		expect(bill.totalFee.toString()).toBe(index === 0 ? "31500" : "0");
		expect(bill.paidAmount.toString()).toBe("40000");
		expect(bill.paymentStatus).toBe(index === 0 ? "FULLY_PAID" : "UNPAID");
		expect(
			await prisma.notification.count({
				where: { userId: user.id, type: "SECTION_CANCELLED" },
			}),
		).toBe(1);
	}
	expect(
		await prisma.routineEntry.count({
			where: { routineId: fixture.routine.id, sectionId: fixture.section.id },
		}),
	).toBe(0);
	expect(
		await prisma.auditLog.count({
			where: { entityId: fixture.section.id, action: "SECTION_CANCELLED" },
		}),
	).toBe(1);
});

it("F5 extra section uses N+1 and rescheduling updates both records and emails students", async () => {
	const fixture = preparedWorld;
	const { user } = preparedEnrollments[0];
	const extra = await request(app)
		.post("/api/admin/sections")
		.set("Authorization", authorization())
		.send({
			offeringId: fixture.offering.id,
			capacity: 30,
			roomId: fixture.room.id,
			dayPatternId: fixture.pattern.id,
			timeSlotId: fixture.nextSlot.id,
		});
	expect(extra.status).toBe(201);
	expect(extra.body.data.sectionNo).toBe(2);
	expect(
		await prisma.routineEntry.count({
			where: { sectionId: extra.body.data.id, routineId: fixture.routine.id },
		}),
	).toBe(1);
	const response = await request(app)
		.patch(`/api/admin/sections/${fixture.section.id}/schedule`)
		.set("Authorization", authorization())
		.send({
			roomId: fixture.otherRoom.id,
			dayPatternId: fixture.pattern.id,
			timeSlotId: fixture.slot.id,
			reason: "Room change",
		});
	expect(response.status).toBe(200);
	expect(
		externalMocks.emails.some(
			(email) =>
				email.to === user.email && email.templateData.reason === "Room change",
		),
	).toBe(true);
	expect(
		(
			await prisma.routineEntry.findFirstOrThrow({
				where: { sectionId: fixture.section.id, routineId: fixture.routine.id },
			})
		).roomId,
	).toBe(fixture.otherRoom.id);
});

let preparedWorld: Awaited<ReturnType<typeof scheduledWorld>>;
let preparedEnrollments: Awaited<ReturnType<typeof enroll>>[];
beforeEach(async ({ task }) => {
	const name = task.name;
	if (
		name.startsWith("T-SEC-01") ||
		name.startsWith("T-SEC-02") ||
		name.startsWith("F5 offering removal")
	)
		return;
	if (name.startsWith("F5 bulk teacher swaps"))
		await prisma.semester.updateMany({
			where: { phase: { not: "CLOSED" } },
			data: { phase: "CLOSED" },
		});
	preparedWorld = await scheduledWorld();
	preparedEnrollments = [];
	if (name.startsWith("T-SEC-04"))
		preparedEnrollments = [
			await enroll(preparedWorld),
			await enroll(preparedWorld),
		];
	else if (name.startsWith("T-SEC-06"))
		preparedEnrollments = [await enroll(preparedWorld, true)];
	else if (name.startsWith("T-SEC-07"))
		preparedEnrollments = [
			await enroll(preparedWorld, true),
			await enroll(preparedWorld),
			await enroll(preparedWorld),
		];
	else if (name.startsWith("T-SEC-09"))
		preparedEnrollments = [
			await enroll(preparedWorld),
			await enroll(preparedWorld),
			await enroll(preparedWorld),
		];
	else if (name.startsWith("F5 extra section"))
		preparedEnrollments = [await enroll(preparedWorld)];
});
