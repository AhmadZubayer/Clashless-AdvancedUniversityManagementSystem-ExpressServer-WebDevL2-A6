import { Prisma } from "../../../generated/prisma/client";
import type { LetterGrade } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { calculateAcademicStanding, getGradePoint } from "../../utils/grade";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import { createNotificationsIntoDB } from "../notification/notification.service";
import type { IGradeSubmission } from "./grade.interface";

const publishOptions = {
	isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
	timeout: 120000,
	maxWait: 20000,
};

// Grades count as published once CourseResult rows exist for the semester.
const gradesPublished = async (semesterId: string) =>
	(await prisma.courseResult.count({ where: { semesterId } })) > 0;

async function loadSection(sectionId: string) {
	const section = await prisma.section.findUnique({
		where: { id: sectionId },
		include: {
			faculty: { select: { id: true, userId: true } },
			offering: {
				select: {
					semesterId: true,
					semester: { select: { id: true, phase: true, gradeDeadline: true } },
					course: { select: { code: true, title: true } },
				},
			},
		},
	});
	if (!section) throw new AppError(404, "Section not found");
	return section;
}

const submitGradesIntoDB = async (
	sectionId: string,
	actor: RequestUser,
	payload: IGradeSubmission,
) => {
	const section = await loadSection(sectionId);
	if (section.faculty?.userId !== actor.id)
		throw new AppError(403, "Only the section's teacher may submit grades");
	const { semester } = section.offering;
	if (semester.phase !== "EXAMS" && semester.phase !== "GRADING")
		throw new AppError(
			409,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	if (semester.gradeDeadline && Date.now() > semester.gradeDeadline.getTime())
		throw new AppError(409, "The grade deadline has passed");
	if (await gradesPublished(semester.id))
		throw new AppError(409, "Grades have already been published");
	const ids = payload.grades.map((row) => row.enrollmentId);
	const enrollments = await prisma.enrollment.findMany({
		where: { id: { in: ids }, sectionId, status: "ENROLLED" },
		select: { id: true },
	});
	if (enrollments.length !== new Set(ids).size)
		throw new AppError(
			400,
			"Grades can only be set for ENROLLED students of this section",
		);
	const now = new Date();
	await prisma.$transaction(
		payload.grades.map((row) =>
			prisma.enrollment.update({
				where: { id: row.enrollmentId },
				data: { grade: row.grade, gradeSubmittedAt: now },
			}),
		),
	);
	return { updated: payload.grades.length };
};

const getSectionGradesFromDB = async (
	sectionId: string,
	actor: RequestUser,
) => {
	const section = await loadSection(sectionId);
	if (actor.role === "FACULTY" && section.faculty?.userId !== actor.id)
		throw new AppError(403, "Only the section's teacher may view this sheet");
	const enrollments = await prisma.enrollment.findMany({
		where: { sectionId, status: "ENROLLED" },
		select: {
			id: true,
			grade: true,
			gradeSubmittedAt: true,
			student: { select: { id: true, universityId: true, name: true } },
		},
		orderBy: { student: { universityId: "asc" } },
	});
	return {
		section: {
			id: section.id,
			sectionNo: section.sectionNo,
			course: section.offering.course,
		},
		students: enrollments.map((row) => ({
			enrollmentId: row.id,
			student: row.student,
			grade: row.grade,
			gradeSubmittedAt: row.gradeSubmittedAt,
		})),
	};
};

const getGradeStatusFromDB = async (semesterId: string) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(404, "Semester not found");
	const sections = await prisma.section.findMany({
		where: { offering: { semesterId }, status: { not: "CANCELLED" } },
		select: {
			id: true,
			sectionNo: true,
			faculty: { select: { id: true, name: true } },
			offering: { select: { course: { select: { code: true } } } },
			enrollments: {
				where: { status: "ENROLLED" },
				select: { grade: true },
			},
		},
		orderBy: [{ offering: { course: { code: "asc" } } }, { sectionNo: "asc" }],
	});
	return sections.map((section) => {
		const submitted = section.enrollments.filter((row) => row.grade).length;
		return {
			sectionId: section.id,
			courseCode: section.offering.course.code,
			sectionNo: section.sectionNo,
			faculty: section.faculty,
			enrolled: section.enrollments.length,
			submitted,
			missing: section.enrollments.length - submitted,
		};
	});
};

const publishGradesIntoDB = async (semesterId: string, actorId: string) => {
	const semester = await prisma.semester.findUnique({
		where: { id: semesterId },
	});
	if (!semester) throw new AppError(404, "Semester not found");
	if (semester.phase !== "GRADING")
		throw new AppError(409, "Publishing grades requires GRADING", {
			code: "PHASE_NOT_ALLOWED",
		});
	if (await gradesPublished(semesterId))
		throw new AppError(409, "Grades have already been published");
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.database_schema))
		throw new Error("Unsupported database schema identifier");
	return prisma.$transaction(async (tx) => {
		const enrollments = await tx.enrollment.findMany({
			where: { semesterId, status: "ENROLLED" },
			select: {
				id: true,
				grade: true,
				credits: true,
				studentId: true,
				section: {
					select: {
						id: true,
						sectionNo: true,
						offering: {
							select: { course: { select: { id: true, code: true } } },
						},
					},
				},
			},
		});
		const missing = new Map<
			string,
			{
				sectionId: string;
				courseCode: string;
				sectionNo: number;
				missing: number;
			}
		>();
		for (const row of enrollments)
			if (!row.grade) {
				const entry = missing.get(row.section.id) ?? {
					sectionId: row.section.id,
					courseCode: row.section.offering.course.code,
					sectionNo: row.section.sectionNo,
					missing: 0,
				};
				entry.missing += 1;
				missing.set(row.section.id, entry);
			}
		if (missing.size)
			throw new AppError(409, "Some sections have not submitted all grades", {
				sections: [...missing.values()],
			});
		await tx.courseResult.createMany({
			data: enrollments.map((row) => ({
				grade: row.grade as LetterGrade,
				gradePoint: getGradePoint(row.grade as LetterGrade) ?? 0,
				credits: row.credits,
				studentId: row.studentId,
				courseId: row.section.offering.course.id,
				semesterId,
			})),
		});
		const studentIds = [...new Set(enrollments.map((row) => row.studentId))];
		const results = await tx.courseResult.findMany({
			where: { studentId: { in: studentIds } },
			select: {
				studentId: true,
				courseId: true,
				grade: true,
				gradePoint: true,
				credits: true,
			},
		});
		const byStudent = new Map<string, typeof results>();
		for (const row of results)
			byStudent.set(row.studentId, [
				...(byStudent.get(row.studentId) ?? []),
				row,
			]);
		const updates = studentIds.map((studentId) => ({
			studentId,
			...calculateAcademicStanding(byStudent.get(studentId) ?? []),
		}));
		const students = Prisma.raw(`"${config.database_schema}"."students"`);
		for (let start = 0; start < updates.length; start += 500) {
			const chunk = updates.slice(start, start + 500);
			await tx.$executeRaw(
				Prisma.sql`UPDATE ${students} AS s SET "cgpa" = v."cgpa", "earnedCredits" = v."earned", "updatedAt" = CURRENT_TIMESTAMP FROM (VALUES ${Prisma.join(
					chunk.map(
						(row) =>
							Prisma.sql`(${row.studentId}, ${row.cgpa}::numeric, ${row.earnedCredits}::numeric)`,
					),
				)}) AS v("id", "cgpa", "earned") WHERE s."id" = v."id"`,
			);
		}
		const owners = await tx.student.findMany({
			where: { id: { in: studentIds } },
			select: { userId: true },
		});
		await createNotificationsIntoDB(
			tx,
			owners.map((owner) => ({
				userId: owner.userId,
				type: "GRADES_PUBLISHED",
				title: "Results published",
				message: `Your ${semester.name} results are now available.`,
			})),
		);
		await createAuditLogIntoDB(tx, {
			actorId,
			action: "GRADES_PUBLISHED",
			entity: "Semester",
			entityId: semesterId,
			after: { results: enrollments.length, students: studentIds.length },
		});
		return { results: enrollments.length, students: studentIds.length };
	}, publishOptions);
};

const getMyGradesFromDB = async (userId: string) => {
	const student = await prisma.student.findUnique({
		where: { userId },
		select: { id: true, cgpa: true, earnedCredits: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	const results = await prisma.courseResult.findMany({
		where: { studentId: student.id },
		include: {
			course: { select: { code: true, title: true } },
			semester: { select: { id: true, code: true, name: true } },
		},
		orderBy: { createdAt: "asc" },
	});
	const semesters = new Map<
		string,
		{
			semester: { id: string; code: string; name: string } | null;
			courses: unknown[];
			weighted: Prisma.Decimal;
			credits: Prisma.Decimal;
		}
	>();
	for (const row of results) {
		const key = row.semesterId ?? "history";
		const entry = semesters.get(key) ?? {
			semester: row.semester,
			courses: [],
			weighted: new Prisma.Decimal(0),
			credits: new Prisma.Decimal(0),
		};
		entry.courses.push({
			code: row.course.code,
			title: row.course.title,
			grade: row.grade,
			gradePoint: row.gradePoint,
			credits: row.credits,
		});
		if (row.grade !== "W") {
			entry.weighted = entry.weighted.plus(row.gradePoint.times(row.credits));
			entry.credits = entry.credits.plus(row.credits);
		}
		semesters.set(key, entry);
	}
	const standing = calculateAcademicStanding(results);
	return {
		cgpa: standing.cgpa,
		earnedCredits: standing.earnedCredits,
		semesters: [...semesters.values()].map((entry) => ({
			semester: entry.semester,
			gpa: entry.credits.isZero()
				? new Prisma.Decimal(0)
				: entry.weighted
						.div(entry.credits)
						.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
			courses: entry.courses,
		})),
	};
};

export const gradeService = {
	submitGradesIntoDB,
	getSectionGradesFromDB,
	getGradeStatusFromDB,
	publishGradesIntoDB,
	getMyGradesFromDB,
};
