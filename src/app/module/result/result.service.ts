import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { parseCsv } from "../../utils/csv";
import { calculateAcademicStanding, getGradePoint } from "../../utils/grade";
import type { IImportedResult, IResultImportReport } from "./result.interface";
import { resultValidation } from "./result.validation";

const importResultsIntoDB = async (
	csv: Buffer,
): Promise<IResultImportReport> => {
	const prepared: { row: number; data: IImportedResult }[] = [];
	const failed: IResultImportReport["failed"] = [];
	for (const row of parseCsv(csv.toString("utf8"))) {
		if (row.error) {
			failed.push({ row: row.row, reason: row.error });
			continue;
		}
		const parsed = resultValidation.rowSchema.safeParse(row.values);
		if (!parsed.success) {
			failed.push({
				row: row.row,
				reason: parsed.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			});
			continue;
		}
		prepared.push({ row: row.row, data: parsed.data });
	}
	if (!prepared.length) return { created: 0, failed };
	const outcome = await prisma.$transaction(
		async (tx) => {
			const students = await tx.student.findMany({
				where: {
					universityId: { in: prepared.map((item) => item.data.universityId) },
					isDeleted: false,
					user: { isDeleted: false },
				},
				select: { id: true, universityId: true },
			});
			const courses = await tx.course.findMany({
				where: {
					code: { in: prepared.map((item) => item.data.courseCode) },
					isDeleted: false,
				},
				select: { id: true, code: true, credits: true },
			});
			const studentMap = new Map(
				students.map((student) => [student.universityId, student]),
			);
			const courseMap = new Map(courses.map((course) => [course.code, course]));
			const accepted: Prisma.CourseResultCreateManyInput[] = [];
			const rejected: IResultImportReport["failed"] = [];
			const affected = new Set<string>();
			for (const item of prepared) {
				const student = studentMap.get(item.data.universityId);
				const course = courseMap.get(item.data.courseCode);
				if (!student || !course) {
					rejected.push({
						row: item.row,
						reason: !student ? "Student not found" : "Course not found",
					});
					continue;
				}
				accepted.push({
					studentId: student.id,
					courseId: course.id,
					semesterId: null,
					grade: item.data.grade,
					gradePoint: getGradePoint(item.data.grade) ?? new Prisma.Decimal(0),
					credits: course.credits,
				});
				affected.add(student.id);
			}
			for (let offset = 0; offset < accepted.length; offset += 500)
				await tx.courseResult.createMany({
					data: accepted.slice(offset, offset + 500),
				});
			const attempts = await tx.courseResult.findMany({
				where: { studentId: { in: [...affected] } },
				orderBy: { createdAt: "desc" },
			});
			const byStudent = new Map<string, typeof attempts>();
			for (const attempt of attempts) {
				const list = byStudent.get(attempt.studentId) ?? [];
				list.push(attempt);
				byStudent.set(attempt.studentId, list);
			}
			for (const studentId of affected)
				await tx.student.update({
					where: { id: studentId },
					data: calculateAcademicStanding(byStudent.get(studentId) ?? []),
				});
			return { created: accepted.length, rejected };
			// Result rows and their aggregate grades commit together. Bulk imports need
			// longer than the default 5 seconds over the configured hosted connection.
		},
		{
			isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
			timeout: 60000,
		},
	);
	return {
		created: outcome.created,
		failed: [...failed, ...outcome.rejected].sort((a, b) => a.row - b.row),
	};
};
export const resultService = { importResultsIntoDB };
