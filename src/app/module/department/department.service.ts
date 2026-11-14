import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateDepartment,
	IUpdateDepartment,
	IDepartmentQuery,
} from "./department.interface";

const createDepartmentIntoDB = (payload: ICreateDepartment) =>
	prisma.$transaction(async (tx) => {
		if (await tx.department.findUnique({ where: { code: payload.code } }))
			throw new AppError(httpStatus.CONFLICT, "Department code already exists");
		return tx.department.create({ data: payload });
	});

const getAllDepartmentsFromDB = async (query: IDepartmentQuery) => {
	const where: Prisma.DepartmentWhereInput = {
		isDeleted: false,
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
		prisma.department.findMany({
			where,
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.department.count({ where }),
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

const updateDepartmentIntoDB = (id: string, payload: IUpdateDepartment) =>
	prisma.$transaction(async (tx) => {
		if (!(await tx.department.findFirst({ where: { id, isDeleted: false } })))
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		if (
			payload.code &&
			(await tx.department.findFirst({
				where: { code: payload.code, id: { not: id } },
			}))
		)
			throw new AppError(httpStatus.CONFLICT, "Department code already exists");
		return tx.department.update({ where: { id }, data: payload });
	});

const deleteDepartmentFromDB = (id: string) =>
	prisma.$transaction(async (tx) => {
		if (!(await tx.department.findFirst({ where: { id, isDeleted: false } })))
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		const courses = await tx.course.count({
			where: { departmentId: id, isDeleted: false },
		});
		const faculty = await tx.faculty.count({
			where: { departmentId: id, isDeleted: false },
		});
		if (courses || faculty)
			throw new AppError(
				httpStatus.CONFLICT,
				"Department has active courses or faculty",
			);
		return tx.department.update({ where: { id }, data: { isDeleted: true } });
	});

export const departmentService = {
	createDepartmentIntoDB,
	getAllDepartmentsFromDB,
	updateDepartmentIntoDB,
	deleteDepartmentFromDB,
};
