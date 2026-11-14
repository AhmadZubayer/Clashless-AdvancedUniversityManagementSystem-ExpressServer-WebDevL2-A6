import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
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

export const semesterService = {
	createSemesterIntoDB,
	getAllSemestersFromDB,
	getCurrentSemesterFromDB,
	getSemesterByIdFromDB,
	updateSemesterIntoDB,
};
