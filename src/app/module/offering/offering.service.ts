import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateOffering, IOfferingQuery } from "./offering.interface";

const createOfferingIntoDB = (payload: ICreateOffering) =>
	prisma.$transaction(
		async (tx) => {
			const semester = await tx.semester.findUnique({
				where: { id: payload.semesterId },
			});
			if (!semester)
				throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
			if (semester.phase !== "PLANNING")
				throw new AppError(
					httpStatus.CONFLICT,
					"Offerings can only be created during PLANNING",
					{ code: "PHASE_NOT_ALLOWED" },
				);
			if (
				!(await tx.course.findFirst({
					where: { id: payload.courseId, isDeleted: false },
					select: { id: true },
				}))
			)
				throw new AppError(httpStatus.NOT_FOUND, "Course not found");
			if (
				await tx.courseOffering.findUnique({
					where: {
						unique_offering: {
							semesterId: payload.semesterId,
							courseId: payload.courseId,
						},
					},
				})
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"Course is already offered in this semester",
				);
			return tx.courseOffering.create({
				data: {
					semesterId: payload.semesterId,
					courseId: payload.courseId,
					sections: {
						createMany: {
							data: Array.from(
								{ length: payload.sectionCount },
								(_, index) => ({
									sectionNo: index + 1,
									capacity: payload.capacity,
								}),
							),
						},
					},
				},
				include: { course: true, sections: { orderBy: { sectionNo: "asc" } } },
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

const getAllOfferingsFromDB = async (query: IOfferingQuery) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: query.semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	const where: Prisma.CourseOfferingWhereInput = {
		semesterId: query.semesterId,
		course: {
			...(query.departmentId ? { departmentId: query.departmentId } : {}),
			...(query.searchTerm
				? {
						OR: [
							{ code: { contains: query.searchTerm, mode: "insensitive" } },
							{ title: { contains: query.searchTerm, mode: "insensitive" } },
						],
					}
				: {}),
		},
	};
	const [data, total] = await prisma.$transaction([
		prisma.courseOffering.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
			include: {
				course: true,
				sections: {
					orderBy: { sectionNo: "asc" },
					include: {
						faculty: {
							select: {
								id: true,
								name: true,
								email: true,
								designation: true,
								departmentId: true,
							},
						},
						room: true,
						dayPattern: true,
						timeSlot: true,
					},
				},
			},
		}),
		prisma.courseOffering.count({ where }),
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

const deleteOfferingFromDB = (id: string) =>
	prisma.$transaction(
		async (tx) => {
			const offering = await tx.courseOffering.findUnique({
				where: { id },
				include: { semester: { select: { phase: true } } },
			});
			if (!offering)
				throw new AppError(httpStatus.NOT_FOUND, "Offering not found");
			if (offering.semester.phase !== "PLANNING")
				throw new AppError(
					httpStatus.CONFLICT,
					"Offerings can only be removed during PLANNING",
					{ code: "PHASE_NOT_ALLOWED" },
				);
			if (await tx.enrollment.count({ where: { offeringId: id } }))
				throw new AppError(
					httpStatus.CONFLICT,
					"Offering has enrollment history and cannot be removed",
				);
			await tx.section.deleteMany({ where: { offeringId: id } });
			return tx.courseOffering.delete({ where: { id } });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

export const offeringService = {
	createOfferingIntoDB,
	getAllOfferingsFromDB,
	deleteOfferingFromDB,
};
