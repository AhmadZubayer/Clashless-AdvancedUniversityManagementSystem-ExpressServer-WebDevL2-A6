import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { hasPrerequisiteCycle } from "../../engine/prerequisiteGraph";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateCourse,
	IUpdateCourse,
	ICourseQuery,
	IPrerequisiteItem,
} from "./course.interface";

const createCourseIntoDB = (payload: ICreateCourse) =>
	prisma.$transaction(async (tx) => {
		if (
			!(await tx.department.findFirst({
				where: { id: payload.departmentId, isDeleted: false },
			}))
		)
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		if (await tx.course.findUnique({ where: { code: payload.code } }))
			throw new AppError(httpStatus.CONFLICT, "Course code already exists");
		return tx.course.create({ data: payload });
	});
const getAllCoursesFromDB = async (query: ICourseQuery) => {
	const where: Prisma.CourseWhereInput = {
		isDeleted: false,
		...(query.departmentId ? { departmentId: query.departmentId } : {}),
		...(query.type ? { type: query.type } : {}),
		...(query.searchTerm
			? {
					OR: [
						{ title: { contains: query.searchTerm, mode: "insensitive" } },
						{ code: { contains: query.searchTerm, mode: "insensitive" } },
					],
				}
			: {}),
	};
	const [data, total] = await prisma.$transaction([
		prisma.course.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.course.count({ where }),
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
const getCourseByIdFromDB = async (id: string) => {
	const course = await prisma.course.findFirst({
		where: { id, isDeleted: false },
		include: {
			prerequisites: { include: { prerequisite: true } },
			curriculum: { orderBy: { term: "asc" }, include: { program: true } },
		},
	});
	if (!course) throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	return course;
};
const updateCourseIntoDB = (id: string, payload: IUpdateCourse) =>
	prisma.$transaction(async (tx) => {
		const course = await tx.course.findFirst({
			where: { id, isDeleted: false },
		});
		if (!course) throw new AppError(httpStatus.NOT_FOUND, "Course not found");
		const changesRules =
			(payload.credits && !payload.credits.equals(course.credits)) ||
			(payload.type && payload.type !== course.type);
		if (
			changesRules &&
			(await tx.courseOffering.findFirst({
				where: {
					courseId: id,
					semester: { phase: { notIn: ["PLANNING", "CLOSED"] } },
				},
			}))
		)
			throw new AppError(
				httpStatus.CONFLICT,
				"Offered course credits and type are locked after planning",
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
			(await tx.course.findFirst({
				where: { code: payload.code, id: { not: id } },
			}))
		)
			throw new AppError(httpStatus.CONFLICT, "Course code already exists");
		return tx.course.update({ where: { id }, data: payload });
	});
const deleteCourseFromDB = (id: string) =>
	prisma.$transaction(async (tx) => {
		if (!(await tx.course.findFirst({ where: { id, isDeleted: false } })))
			throw new AppError(httpStatus.NOT_FOUND, "Course not found");
		if (
			await tx.courseOffering.findFirst({
				where: { courseId: id, semester: { phase: { not: "CLOSED" } } },
			})
		)
			throw new AppError(
				httpStatus.CONFLICT,
				"Course is offered in an active semester",
			);
		return tx.course.update({ where: { id }, data: { isDeleted: true } });
	});
const replacePrerequisitesIntoDB = (id: string, items: IPrerequisiteItem[]) =>
	prisma.$transaction(
		async (tx) => {
			if (!(await tx.course.findFirst({ where: { id, isDeleted: false } })))
				throw new AppError(httpStatus.NOT_FOUND, "Course not found");
			if (items.some((item) => item.prerequisiteId === id))
				throw new AppError(
					httpStatus.CONFLICT,
					"A course cannot require itself",
				);
			if (
				(await tx.course.count({
					where: {
						id: { in: items.map((item) => item.prerequisiteId) },
						isDeleted: false,
					},
				})) !== items.length
			)
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Prerequisite course not found",
				);
			const existing = await tx.coursePrerequisite.findMany({
				where: { courseId: { not: id } },
				select: { courseId: true, prerequisiteId: true },
			});
			if (
				hasPrerequisiteCycle([
					...existing,
					...items.map((item) => ({
						courseId: id,
						prerequisiteId: item.prerequisiteId,
					})),
				])
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"Prerequisites would create a cycle",
				);
			await tx.coursePrerequisite.deleteMany({ where: { courseId: id } });
			await tx.coursePrerequisite.createMany({
				data: items.map((item) => ({ ...item, courseId: id })),
			});
			return tx.coursePrerequisite.findMany({
				where: { courseId: id },
				include: { prerequisite: true },
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
export const courseService = {
	createCourseIntoDB,
	getAllCoursesFromDB,
	getCourseByIdFromDB,
	updateCourseIntoDB,
	deleteCourseFromDB,
	replacePrerequisitesIntoDB,
};
