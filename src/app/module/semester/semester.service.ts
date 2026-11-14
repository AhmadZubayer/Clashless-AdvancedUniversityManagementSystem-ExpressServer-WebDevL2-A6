import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { UserRole, SemesterPhase } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import type {
	ICreateSemester,
	ISemesterQuery,
	IUpdateSemester,
} from "./semester.interface";

const createSemesterIntoDB = (payload: ICreateSemester) =>
	prisma.$transaction(
		async (tx) => {
			if (
				await tx.semester.findFirst({
					where: { phase: { not: "CLOSED" } },
					select: { id: true },
				})
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"Another semester is still open",
				);
			if (
				await tx.semester.findUnique({
					where: { code: payload.code },
					select: { id: true },
				})
			)
				throw new AppError(httpStatus.CONFLICT, "Semester code already exists");
			return tx.semester.create({ data: { ...payload, phase: "PLANNING" } });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

const getAllSemestersFromDB = async (query: ISemesterQuery) => {
	const where: Prisma.SemesterWhereInput = query.searchTerm
		? {
				OR: [
					{ code: { contains: query.searchTerm, mode: "insensitive" } },
					{ name: { contains: query.searchTerm, mode: "insensitive" } },
				],
			}
		: {};
	const [data, total] = await prisma.$transaction([
		prisma.semester.findMany({
			where,
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.semester.count({ where }),
	]);
	return {
		data,
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};

const getCurrentSemesterFromDB = async (actor: RequestUser) => {
	const semester = await prisma.semester.findFirst({
		where: { phase: { not: "CLOSED" } },
	});
	if (!semester)
		throw new AppError(httpStatus.NOT_FOUND, "No current semester");
	if (actor.role !== UserRole.STUDENT) return semester;
	const student = await prisma.student.findUnique({
		where: { userId: actor.id },
		select: { batchId: true },
	});
	if (!student)
		throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
	const registrationWindow = await prisma.registrationWindow.findUnique({
		where: {
			unique_batch_window: {
				semesterId: semester.id,
				batchId: student.batchId,
			},
		},
	});
	return {
		...semester,
		registrationWindow,
		serverTime: new Date().toISOString(),
	};
};

const getSemesterByIdFromDB = (id: string) =>
	prisma.$transaction(async (tx) => {
		const semester = await tx.semester.findUnique({
			where: { id },
			include: { _count: { select: { offerings: true, registrations: true } } },
		});
		if (!semester)
			throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
		const sections = await tx.section.count({
			where: { offering: { semesterId: id } },
		});
		const { _count, ...data } = semester;
		return {
			...data,
			counts: {
				offerings: _count.offerings,
				sections,
				registrations: _count.registrations,
			},
		};
	});

const updateSemesterIntoDB = (id: string, payload: IUpdateSemester) =>
	prisma.$transaction(
		async (tx) => {
			const semester = await tx.semester.findUnique({ where: { id } });
			if (!semester)
				throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
			if (
				semester.phase !== "PLANNING" &&
				(payload.maxCredits !== undefined ||
					payload.minPaymentPercent !== undefined ||
					payload.paymentDeadlineDays !== undefined)
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"Semester rules are locked after PLANNING",
					{ code: "PHASE_NOT_ALLOWED" },
				);
			if (
				payload.code &&
				(await tx.semester.findFirst({
					where: { code: payload.code, id: { not: id } },
				}))
			)
				throw new AppError(httpStatus.CONFLICT, "Semester code already exists");
			return tx.semester.update({ where: { id }, data: payload });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

function failGate(gate: string, message: string): never {
	throw new AppError(httpStatus.CONFLICT, message, {
		code: "PHASE_NOT_ALLOWED",
		gate,
	});
}

const changeSemesterPhaseIntoDB = (
	actor: RequestUser,
	id: string,
	nextPhase: SemesterPhase,
) =>
	prisma.$transaction(
		async (tx) => {
			const semester = await tx.semester.findUnique({ where: { id } });
			if (!semester)
				throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
			const order: SemesterPhase[] = [
				"PLANNING",
				"REGISTRATION",
				"CLASSES",
				"EXAMS",
				"GRADING",
				"CLOSED",
			];
			if (order.indexOf(nextPhase) !== order.indexOf(semester.phase) + 1)
				failGate(
					"NEXT_PHASE",
					"Move forward exactly one semester phase at a time",
				);
			if (nextPhase === SemesterPhase.REGISTRATION) {
				if (
					!(await tx.routine.findFirst({
						where: { semesterId: id, status: "PUBLISHED" },
						select: { id: true },
					}))
				)
					failGate(
						"PUBLISHED_CLASS_ROUTINE",
						"A published class routine is required before REGISTRATION",
					);
				if (
					!(await tx.registrationWindow.findFirst({
						where: { semesterId: id },
						select: { id: true },
					}))
				)
					failGate(
						"REGISTRATION_WINDOW",
						"At least one registration window is required before REGISTRATION",
					);
			}
			if (
				nextPhase === SemesterPhase.CLASSES &&
				(await tx.registrationWindow.findFirst({
					where: { semesterId: id, endsAt: { gt: new Date() } },
					select: { id: true },
				}))
			)
				failGate(
					"WINDOWS_ENDED",
					"Every registration window must have ended before CLASSES",
				);
			if (nextPhase === SemesterPhase.EXAMS) {
				const routine = await tx.examRoutine.findFirst({
					where: { semesterId: id, status: "PUBLISHED" },
					select: { id: true },
				});
				if (!routine)
					failGate(
						"PUBLISHED_EXAM_ROUTINE",
						"A published exam routine is required before EXAMS",
					);
				const missingPlan = await tx.examSlot.findFirst({
					where: {
						semesterId: id,
						AND: [
							{
								OR: [
									{ offerings: { some: { semesterId: id } } },
									{ examEntries: { some: { examRoutineId: routine.id } } },
								],
							},
							{
								OR: [
									{ seatPlan: null },
									{ seatPlan: { status: { not: "PUBLISHED" } } },
								],
							},
						],
					},
					select: { id: true },
				});
				if (missingPlan)
					failGate(
						"PUBLISHED_SEAT_PLANS",
						"Every exam slot with courses needs a published seat plan before EXAMS",
					);
			}
			if (nextPhase === SemesterPhase.CLOSED) {
				const enrollments = await tx.enrollment.findMany({
					where: { semesterId: id, status: "ENROLLED" },
					select: {
						studentId: true,
						grade: true,
						offering: { select: { courseId: true } },
					},
				});
				const results = await tx.courseResult.findMany({
					where: { semesterId: id },
					select: { studentId: true, courseId: true, grade: true },
				});
				const published = new Set(
					results.map(
						(result) =>
							`${result.studentId}:${result.courseId}:${result.grade}`,
					),
				);
				if (
					enrollments.some(
						(enrollment) =>
							enrollment.grade === null ||
							!published.has(
								`${enrollment.studentId}:${enrollment.offering.courseId}:${enrollment.grade}`,
							),
					)
				)
					failGate(
						"GRADES_PUBLISHED",
						"Grades must be published before CLOSED",
					);
			}
			const changed = await tx.semester.updateMany({
				where: { id, phase: semester.phase },
				data: { phase: nextPhase },
			});
			if (changed.count !== 1)
				throw new AppError(
					httpStatus.CONFLICT,
					"Semester phase changed; please retry",
				);
			await createAuditLogIntoDB(tx, {
				actorId: actor.id,
				action: "SEMESTER_PHASE_CHANGED",
				entity: "Semester",
				entityId: id,
				before: { phase: semester.phase },
				after: { phase: nextPhase },
			});
			return tx.semester.findUniqueOrThrow({ where: { id } });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

export const semesterService = {
	changeSemesterPhaseIntoDB,
	createSemesterIntoDB,
	getAllSemestersFromDB,
	getCurrentSemesterFromDB,
	getSemesterByIdFromDB,
	updateSemesterIntoDB,
};
