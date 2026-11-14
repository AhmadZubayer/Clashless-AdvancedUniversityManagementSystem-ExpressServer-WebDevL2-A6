import { beforeAll, expect, it } from "vitest";
import { openDemoRegistrationIntoDB } from "../../prisma/openDemoRegistration";
import { prisma } from "../../src/app/lib/prisma";
import {
	createAcademicWorld,
	createAdmin,
	createFaculty,
	createStudent,
} from "../helpers/factory";

let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let admin: Awaited<ReturnType<typeof createAdmin>>;
let semesterId: string;
let sectionId: string;
let offeringId: string;
let routineId: string;
const startsAt = new Date("2026-11-14T08:00:00Z");

beforeAll(async () => {
	world = await createAcademicWorld();
	admin = await createAdmin();
	const teacher = await createFaculty(world.department.id);
	semesterId = (
		await prisma.semester.create({
			data: { code: "DEMO-OPEN", name: "Demo option" },
		})
	).id;
	const course = await prisma.course.create({
		data: {
			code: "DEMO-OPEN-COURSE",
			title: "Demo",
			type: "THEORY",
			credits: 3,
			departmentId: world.department.id,
		},
	});
	offeringId = (
		await prisma.courseOffering.create({
			data: { semesterId, courseId: course.id },
		})
	).id;
	sectionId = (
		await prisma.section.create({
			data: { offeringId, sectionNo: 1, facultyId: teacher.faculty!.id },
		})
	).id;
	await prisma.room.create({
		data: {
			code: "DEMO-OPEN-ROOM",
			building: "Demo",
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
		data: { code: "DEMO-OPEN-ST", type: "THEORY", days: ["SUN", "TUE"] },
	});
});
it("F7 demo registration option generates, publishes, transitions and opens a two-hour window", async () => {
	const result = await openDemoRegistrationIntoDB(
		semesterId,
		admin.id,
		world.batch.id,
		startsAt,
	);
	routineId = result.routineId;
	expect(result.window).toMatchObject({
		startsAt,
		endsAt: new Date(startsAt.getTime() + 2 * 3600000),
	});
	expect(
		(await prisma.semester.findUniqueOrThrow({ where: { id: semesterId } }))
			.phase,
	).toBe("REGISTRATION");
	expect(
		(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } }))
			.status,
	).toBe("PUBLISHED");
	const section = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	expect(section.roomId).toBeTruthy();
	expect(section.dayPatternId).toBeTruthy();
	expect(section.timeSlotId).toBeTruthy();
	expect(
		await prisma.auditLog.count({
			where: { entityId: semesterId, action: "SEMESTER_PHASE_CHANGED" },
		}),
	).toBe(1);
});
it("F7 demo option reruns without duplicating routines or destroying bills and enrollments", async () => {
	const student = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const registration = await prisma.semesterRegistration.create({
		data: {
			semesterId,
			studentId: student.student!.id,
			totalCredits: 3,
			totalFee: 31500,
			paidAmount: 40000,
			paymentStatus: "FULLY_PAID",
			paymentDeadline: new Date(startsAt.getTime() + 12 * 86400000),
			enrollments: {
				create: {
					semesterId,
					studentId: student.student!.id,
					sectionId,
					offeringId,
					credits: 3,
				},
			},
		},
	});
	await prisma.section.update({
		where: { id: sectionId },
		data: { enrolledCount: 1 },
	});
	const later = new Date(startsAt.getTime() + 3 * 3600000);
	const result = await openDemoRegistrationIntoDB(
		semesterId,
		admin.id,
		world.batch.id,
		later,
	);
	expect(result.routineId).toBe(routineId);
	expect(result.window.startsAt).toEqual(later);
	expect(await prisma.routine.count({ where: { semesterId } })).toBe(1);
	expect(
		await prisma.registrationWindow.count({
			where: { semesterId, batchId: world.batch.id },
		}),
	).toBe(1);
	const bill = await prisma.semesterRegistration.findUniqueOrThrow({
		where: { id: registration.id },
	});
	expect(bill.totalCredits.toString()).toBe("3");
	expect(bill.paidAmount.toString()).toBe("40000");
	expect(bill.paymentDeadline).toEqual(
		new Date(later.getTime() + 2 * 3600000 + 12 * 86400000),
	);
	expect(
		await prisma.enrollment.count({
			where: { registrationId: registration.id, status: "ENROLLED" },
		}),
	).toBe(1);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(1);
});
it("F7 demo option never rewinds a semester that has entered CLASSES", async () => {
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "CLASSES" },
	});
	await expect(
		openDemoRegistrationIntoDB(semesterId, admin.id, world.batch.id, startsAt),
	).rejects.toThrow("PLANNING or REGISTRATION");
	expect(
		(await prisma.semester.findUniqueOrThrow({ where: { id: semesterId } }))
			.phase,
	).toBe("CLASSES");
	expect(await prisma.routine.count({ where: { semesterId } })).toBe(1);
});
