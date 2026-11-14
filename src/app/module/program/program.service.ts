import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateProgram,
	IUpdateProgram,
	IProgramQuery,
	ICurriculumItem,
} from "./program.interface";

const createProgramIntoDB = (payload: ICreateProgram) =>
	prisma.$transaction(async (tx) => {
		if (
			!(await tx.department.findFirst({
				where: { id: payload.departmentId, isDeleted: false },
			}))
		)
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		if (await tx.program.findUnique({ where: { code: payload.code } }))
			throw new AppError(httpStatus.CONFLICT, "Program code already exists");
		return tx.program.create({ data: payload });
	});
const getAllProgramsFromDB = async (query: IProgramQuery) => {
	const where: Prisma.ProgramWhereInput = {
		department: { isDeleted: false },
		...(query.departmentId ? { departmentId: query.departmentId } : {}),
		...(query.searchTerm
			? {
					OR: [
						{ name: { contains: query.searchTerm, mode: "insensitive" } },
						{ code: { contains: query.searchTerm, mode: "insensitive" } },
					],
				}
			: {}),
	};
	const [data, total] = await prisma.$transaction([
		prisma.program.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.program.count({ where }),
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
const getProgramByIdFromDB = async (id: string) => {
	const program = await prisma.program.findFirst({
		where: { id, department: { isDeleted: false } },
		include: {
			curriculum: {
				orderBy: [{ term: "asc" }, { courseId: "asc" }],
				where: { course: { isDeleted: false } },
				include: { course: true },
			},
		},
	});
	if (!program) throw new AppError(httpStatus.NOT_FOUND, "Program not found");
	return program;
};
const updateProgramIntoDB = (id: string, payload: IUpdateProgram) =>
	prisma.$transaction(async (tx) => {
		const program = await tx.program.findFirst({
			where: { id, department: { isDeleted: false } },
		});
		if (!program) throw new AppError(httpStatus.NOT_FOUND, "Program not found");
		const changesFees =
			(payload.perCreditFee &&
				!payload.perCreditFee.equals(program.perCreditFee)) ||
			(payload.semesterFee && !payload.semesterFee.equals(program.semesterFee));
		if (
			changesFees &&
			(await tx.semester.findFirst({ where: { phase: "REGISTRATION" } }))
		)
			throw new AppError(
				httpStatus.CONFLICT,
				"Fees cannot change during registration",
				{ code: "PHASE_NOT_ALLOWED" },
			);
		if (
			payload.departmentId &&
			!(await tx.department.findFirst({
				where: { id: payload.departmentId, isDeleted: false },
			}))
		)
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		if (
			payload.code &&
			(await tx.program.findFirst({
				where: { code: payload.code, id: { not: id } },
			}))
		)
			throw new AppError(httpStatus.CONFLICT, "Program code already exists");
		return tx.program.update({ where: { id }, data: payload });
	});
const replaceCurriculumIntoDB = (id: string, items: ICurriculumItem[]) =>
	prisma.$transaction(async (tx) => {
		if (
			!(await tx.program.findFirst({
				where: { id, department: { isDeleted: false } },
			}))
		)
			throw new AppError(httpStatus.NOT_FOUND, "Program not found");
		if (
			(await tx.course.count({
				where: {
					id: { in: items.map((item) => item.courseId) },
					isDeleted: false,
				},
			})) !== items.length
		)
			throw new AppError(httpStatus.NOT_FOUND, "A course was not found");
		await tx.curriculumCourse.deleteMany({ where: { programId: id } });
		await tx.curriculumCourse.createMany({
			data: items.map((item) => ({ ...item, programId: id })),
		});
		return tx.curriculumCourse.findMany({
			where: { programId: id },
			orderBy: [{ term: "asc" }, { courseId: "asc" }],
			include: { course: true },
		});
	});
export const programService = {
	createProgramIntoDB,
	getAllProgramsFromDB,
	getProgramByIdFromDB,
	updateProgramIntoDB,
	replaceCurriculumIntoDB,
};
