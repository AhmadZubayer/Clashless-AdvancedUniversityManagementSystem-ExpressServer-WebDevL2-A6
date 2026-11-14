import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import config from "../src/app/config";
import { logger } from "../src/app/lib/logger";
import { prisma } from "../src/app/lib/prisma";
import type { Prisma } from "../src/generated/prisma/client";
import { CourseType, UserRole, Weekday } from "../src/generated/prisma/enums";

interface ICatalogCourse {
	code: string;
	title: string;
	term: number | null;
	credits: number;
	type: CourseType;
	prerequisites: string[];
}
const catalog: ICatalogCourse[] = JSON.parse(
	readFileSync(new URL("./demoCatalog.json", import.meta.url), "utf8").replace(
		/^\uFEFF/,
		"",
	),
);
const idFor = (key: string) => {
	const hex = createHash("sha256")
		.update(`clashless:demo:${key}`)
		.digest("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const departmentFor = (code: string) =>
	({
		CSC: "CSE",
		COE: "CSE",
		MIS: "CSE",
		EEE: "EEE",
		BAE: "EEE",
		PHY: "SCI",
		CHEM: "SCI",
		MAT: "SCI",
		ENG: "ENG",
		BBA: "BUS",
		ECO: "BUS",
		MGT: "BUS",
		BAS: "ARTS",
	})[code.startsWith("CHEM") ? "CHEM" : code.slice(0, 3)];

async function seedDemo() {
	if (!config.demo_password) throw new Error("DEMO_PASSWORD is required");
	const password = await bcrypt.hash(
		config.demo_password,
		Number(config.bcrypt_salt_rounds),
	);
	const departments = ["CSE", "EEE", "SCI", "ENG", "BUS", "ARTS"];
	for (const code of departments)
		await prisma.department.upsert({
			where: { code },
			update: {},
			create: { id: idFor(code), code, name: code },
		});
	const departmentRows = await prisma.department.findMany({
		where: { code: { in: departments } },
	});
	const departmentId = (code: string) =>
		departmentRows.find((row) => row.code === code)!.id;
	const program = await prisma.program.upsert({
		where: { code: "BSCSE" },
		update: {},
		create: {
			code: "BSCSE",
			name: "BSc in Computer Science and Engineering",
			departmentId: departmentId("CSE"),
			totalCreditsRequired: 148,
			perCreditFee: 6500,
			semesterFee: 12000,
		},
	});
	for (const course of catalog)
		await prisma.course.upsert({
			where: { code: course.code },
			update: {},
			create: {
				id: idFor(course.code),
				code: course.code,
				title: course.title,
				credits: course.credits,
				type: course.type,
				departmentId: departmentId(departmentFor(course.code)!),
			},
		});
	const courses = await prisma.course.findMany({
		where: { code: { in: catalog.map((c) => c.code) } },
	});
	const courseByCode = new Map(courses.map((c) => [c.code, c]));
	await prisma.curriculumCourse.createMany({
		skipDuplicates: true,
		data: catalog
			.filter((c) => c.term !== null)
			.map((c) => ({
				programId: program.id,
				courseId: courseByCode.get(c.code)!.id,
				term: c.term!,
			})),
	});
	await prisma.coursePrerequisite.createMany({
		skipDuplicates: true,
		data: catalog.flatMap((c) =>
			c.prerequisites.map((p) => ({
				courseId: courseByCode.get(c.code)!.id,
				prerequisiteId: courseByCode.get(p)!.id,
			})),
		),
	});
	for (let i = 201; i <= 230; i++)
		await prisma.room.upsert({
			where: { code: `FUB-${i}` },
			update: {},
			create: {
				code: `FUB-${i}`,
				building: "FUB",
				roomNo: String(i),
				type: "CLASSROOM",
				capacity: 40,
			},
		});
	for (let i = 1; i <= 8; i++)
		await prisma.room.upsert({
			where: { code: `FUB-LAB${i}` },
			update: {},
			create: {
				code: `FUB-LAB${i}`,
				building: "FUB",
				roomNo: `LAB${i}`,
				type: "LAB",
				capacity: 40,
			},
		});
	for (const [type, starts, duration] of [
		["THEORY", [510, 610, 710, 810, 910], 90],
		["LAB", [510, 710, 910], 180],
	] as const) {
		for (const startMinute of starts)
			await prisma.timeSlot.upsert({
				where: { unique_time_slot: { type, startMinute } },
				update: {},
				create: {
					type,
					startMinute,
					endMinute: startMinute + duration,
					label: `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}-${String(Math.floor((startMinute + duration) / 60)).padStart(2, "0")}:${String((startMinute + duration) % 60).padStart(2, "0")}`,
				},
			});
	}
	const patterns: [string, Weekday[]][] = [
		["ST", [Weekday.SUN, Weekday.TUE]],
		["MW", [Weekday.MON, Weekday.WED]],
		["TR", [Weekday.TUE, Weekday.THU]],
		...["S", "M", "T", "W", "R"].map(
			(code, i) =>
				[
					code,
					[
						[Weekday.SUN, Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU][
							i
						],
					],
				] as [string, Weekday[]],
		),
	];
	for (const [code, days] of patterns)
		await prisma.dayPattern.upsert({
			where: { code },
			update: {},
			create: { code, days, type: days.length === 2 ? "THEORY" : "LAB" },
		});
	const adminEmail = "admin@clashless.test";
	await prisma.user.upsert({
		where: { email: adminEmail },
		update: {},
		create: {
			name: "Demo Admin",
			email: adminEmail,
			password,
			role: UserRole.ADMIN,
			emailVerified: true,
			admin: {
				create: {
					name: "Demo Admin",
					email: adminEmail,
					personalEmail: adminEmail,
				},
			},
		},
	});
	let teacherNumber = 0;
	for (const [dept, count] of [
		["CSE", 40],
		["EEE", 10],
		["SCI", 12],
		["BUS", 4],
		["ENG", 3],
		["ARTS", 3],
	] as const) {
		for (let i = 0; i < count; i++) {
			teacherNumber++;
			const email = `faculty${String(teacherNumber).padStart(2, "0")}@clashless.test`;
			const name = `Faculty ${String(teacherNumber).padStart(2, "0")}`;
			await prisma.user.upsert({
				where: { email },
				update: {},
				create: {
					name,
					email,
					password,
					role: UserRole.FACULTY,
					emailVerified: true,
					faculty: {
						create: {
							name,
							email,
							personalEmail: email,
							designation: "Lecturer",
							maxCreditLoad: 12,
							departmentId: departmentId(dept),
						},
					},
				},
			});
		}
	}
	for (const [code, count, passedTerms] of [
		["22-3", 300, 5],
		["23-1", 300, 4],
		["23-3", 1200, 3],
		["24-1", 300, 2],
	] as const) {
		const batch = await prisma.batch.upsert({
			where: { code },
			update: {},
			create: {
				code,
				intakeYear: 2000 + Number(code.slice(0, 2)),
				intakeTerm: Number(code.slice(3)),
			},
		});
		const past = catalog.filter(
			(c) => c.term !== null && c.term <= passedTerms,
		);
		const earnedCredits = past.reduce((sum, c) => sum + c.credits, 0);
		// Chunk bulk inserts to keep parameter counts and memory bounded over the hosted connection.
		for (let offset = 0; offset < count; offset += 100) {
			const students = Array.from(
				{ length: Math.min(100, count - offset) },
				(_, i) => {
					const universityId = `20${code}-60-${String(offset + i + 1).padStart(4, "0")}`;
					return {
						universityId,
						email: `${universityId}@clashless.test`,
						name: `Student ${universityId}`,
						userId: idFor(`user:${universityId}`),
						id: idFor(`student:${universityId}`),
					};
				},
			);
			await prisma.$transaction(
				async (tx) => {
					await tx.user.createMany({
						skipDuplicates: true,
						data: students.map((s) => ({
							id: s.userId,
							email: s.email,
							name: s.name,
							password,
							role: UserRole.STUDENT,
							emailVerified: true,
						})),
					});
					await tx.student.createMany({
						skipDuplicates: true,
						data: students.map((s) => ({
							...s,
							programId: program.id,
							batchId: batch.id,
							earnedCredits,
							cgpa: 3,
						})),
					});
					const results: Prisma.CourseResultCreateManyInput[] =
						students.flatMap((s) =>
							past.map((c) => ({
								id: idFor(`result:${s.universityId}:${c.code}`),
								studentId: s.id,
								courseId: courseByCode.get(c.code)!.id,
								grade: "B",
								gradePoint: 3,
								credits: c.credits,
							})),
						);
					await tx.courseResult.createMany({
						skipDuplicates: true,
						data: results,
					});
				},
				{ timeout: 60000 },
			);
		}
	}
	const semester = await prisma.semester.upsert({
		where: { code: "2027-1" },
		update: {},
		create: { code: "2027-1", name: "Spring 2027" },
	});
	const faculty = await prisma.faculty.findMany({
		where: { email: { endsWith: "@clashless.test" } },
		orderBy: { email: "asc" },
	});
	const loads = new Map(faculty.map((f) => [f.id, 0]));
	const cursors = new Map<string, number>();
	for (const course of catalog.filter(
		(c) => c.term !== null && c.term >= 3 && c.term <= 6,
	)) {
		const offering = await prisma.courseOffering.upsert({
			where: {
				unique_offering: {
					semesterId: semester.id,
					courseId: courseByCode.get(course.code)!.id,
				},
			},
			update: {},
			create: {
				semesterId: semester.id,
				courseId: courseByCode.get(course.code)!.id,
			},
		});
		const teachers = faculty.filter(
			(f) => f.departmentId === departmentId(departmentFor(course.code)!),
		);
		for (
			let sectionNo = 1;
			sectionNo <= (course.term === 4 ? 10 : 8);
			sectionNo++
		) {
			let index = cursors.get(teachers[0].departmentId) ?? 0;
			let teacher = teachers[index % teachers.length];
			let attempts = 0;
			while (loads.get(teacher.id)! + course.credits > 12) {
				if (++attempts > teachers.length)
					throw new Error(`No faculty load available for ${course.code}`);
				index++;
				teacher = teachers[index % teachers.length];
			}
			loads.set(teacher.id, loads.get(teacher.id)! + course.credits);
			cursors.set(teacher.departmentId, index + 1);
			await prisma.section.upsert({
				where: { unique_section_no: { offeringId: offering.id, sectionNo } },
				update: {},
				create: {
					offeringId: offering.id,
					sectionNo,
					facultyId: teacher.id,
					capacity: 40,
				},
			});
		}
	}
	logger.info({ courses: catalog.length, students: 2100 }, "Demo data ready");
}

seedDemo()
	.catch(() => {
		logger.error("Demo seed failed; check configuration and database state");
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
