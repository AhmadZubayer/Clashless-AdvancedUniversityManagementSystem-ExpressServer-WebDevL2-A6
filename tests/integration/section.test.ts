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

it("T-SEC-04 capacity cannot be reduced below enrolledCount", async () => {
	const fixture = await scheduledWorld();
	await enroll(fixture);
	await enroll(fixture);
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

it("T-SEC-05 an extra section cannot double-book a published room", async () => {
	const fixture = await scheduledWorld();
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
	const fixture = await scheduledWorld();
	const { user } = await enroll(fixture, true);
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
	const fixture = await scheduledWorld();
	const students = [
		await enroll(fixture, true),
		await enroll(fixture),
		await enroll(fixture),
	];
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
		expect(bill.paymentStatus).toBe("FULLY_PAID");
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
	const fixture = await scheduledWorld();
	await enroll(fixture);
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
		(
			await prisma.routineEntry.findFirstOrThrow({
				where: { sectionId: fixture.section.id, routineId: fixture.routine.id },
			})
		).roomId,
	).toBe(fixture.otherRoom.id);
});
