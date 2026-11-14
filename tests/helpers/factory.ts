import { randomUUID } from "node:crypto";
import { prisma } from "../../src/app/lib/prisma";
import { UserRole } from "../../src/generated/prisma/enums";
import type { Batch, Program } from "../../src/generated/prisma/client";

const unique = () => randomUUID().slice(0, 8);

export async function createAcademicWorld() {
	const key = unique();
	const department = await prisma.department.create({
		data: { code: `CSE-${key}`, name: "Computer Science" },
	});
	const program = await prisma.program.create({
		data: {
			departmentId: department.id,
			code: `BSCSE-${key}`,
			name: "BSc CSE",
			totalCreditsRequired: 148,
			perCreditFee: 6500,
			semesterFee: 12000,
		},
	});
	const batch = await prisma.batch.create({
		data: { code: `23-3-${key}`, intakeYear: 2023, intakeTerm: 3 },
	});
	return { department, program, batch };
}

export async function createAdmin(
	role: "ADMIN" | "SUPER_ADMIN" = UserRole.ADMIN,
) {
	const email = `admin-${unique()}@uni.edu`;
	return prisma.user.create({
		data: {
			name: "Admin",
			email,
			role,
			emailVerified: true,
			admin: { create: { name: "Admin", email, personalEmail: email } },
		},
		omit: { password: true },
	});
}

export async function createFaculty(departmentId?: string) {
	const department = departmentId
		? { id: departmentId }
		: (await createAcademicWorld()).department;
	const email = `faculty-${unique()}@uni.edu`;
	return prisma.user.create({
		data: {
			name: "Faculty",
			email,
			role: UserRole.FACULTY,
			emailVerified: true,
			faculty: {
				create: {
					name: "Faculty",
					email,
					personalEmail: email,
					designation: "Lecturer",
					departmentId: department.id,
				},
			},
		},
		include: { faculty: true },
	});
}

export async function createStudent(
	options: { batch?: Batch; program?: Program; passed?: string[] } = {},
) {
	const world =
		options.batch && options.program
			? { batch: options.batch, program: options.program }
			: await createAcademicWorld();
	const program = options.program ?? world.program;
	const batch = options.batch ?? world.batch;
	const key = unique();
	const email = `student-${key}@uni.edu`;
	const user = await prisma.user.create({
		data: {
			name: `Student ${key}`,
			email,
			role: UserRole.STUDENT,
			emailVerified: true,
			student: {
				create: {
					universityId: `2023-3-60-${key}`,
					name: `Student ${key}`,
					email,
					batchId: batch.id,
					programId: program.id,
				},
			},
		},
		include: { student: true },
	});
	for (const code of options.passed ?? []) {
		const course = await prisma.course.upsert({
			where: { code },
			update: {},
			create: {
				code,
				title: code,
				credits: 3,
				type: "THEORY",
				departmentId: program.departmentId,
			},
		});
		await prisma.courseResult.create({
			data: {
				courseId: course.id,
				studentId: user.student!.id,
				grade: "B",
				gradePoint: 3,
				credits: 3,
			},
		});
	}
	return user;
}

export async function createRegistrationWorld(
	options: { sections?: number; capacity?: number; students?: number } = {},
) {
	const world = await createAcademicWorld();
	const faculty = await createFaculty(world.department.id);
	const semester = await prisma.semester.create({
		data: { code: unique(), name: "Registration test", phase: "REGISTRATION" },
	});
	const course = await prisma.course.create({
		data: {
			code: `CSC-${unique()}`,
			title: "Algorithms",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { courseId: course.id, semesterId: semester.id },
	});
	const dayPattern = await prisma.dayPattern.create({
		data: { code: unique(), type: "THEORY", days: ["SUN", "TUE"] },
	});
	const timeSlot = await prisma.timeSlot.upsert({
		where: { unique_time_slot: { type: "THEORY", startMinute: 510 } },
		update: {},
		create: {
			label: "08:30-10:00",
			type: "THEORY",
			startMinute: 510,
			endMinute: 600,
		},
	});
	const routine = await prisma.routine.create({
		data: {
			semesterId: semester.id,
			version: 1,
			status: "PUBLISHED",
			publishedAt: new Date(),
		},
	});
	const sections = [];
	for (let sectionNo = 1; sectionNo <= (options.sections ?? 1); sectionNo++) {
		const room = await prisma.room.create({
			data: {
				code: unique(),
				building: "FUB",
				roomNo: String(sectionNo),
				type: "CLASSROOM",
				capacity: options.capacity ?? 40,
			},
		});
		const section = await prisma.section.create({
			data: {
				sectionNo,
				offeringId: offering.id,
				facultyId: faculty.faculty!.id,
				capacity: options.capacity ?? 40,
				roomId: room.id,
				dayPatternId: dayPattern.id,
				timeSlotId: timeSlot.id,
			},
		});
		await prisma.routineEntry.create({
			data: {
				routineId: routine.id,
				sectionId: section.id,
				roomId: room.id,
				dayPatternId: dayPattern.id,
				timeSlotId: timeSlot.id,
			},
		});
		sections.push(section);
	}
	const now = Date.now();
	const window = await prisma.registrationWindow.create({
		data: {
			semesterId: semester.id,
			batchId: world.batch.id,
			startsAt: new Date(now - 60000),
			endsAt: new Date(now + 3600000),
		},
	});
	const students = [];
	for (let i = 0; i < (options.students ?? 1); i++)
		students.push(
			await createStudent({ batch: world.batch, program: world.program }),
		);
	return {
		...world,
		faculty,
		semester,
		course,
		offering,
		sections,
		students,
		window,
		routine,
		dayPattern,
		timeSlot,
	};
}
