import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateDayPattern,
	IDayPatternQuery,
} from "./dayPattern.interface";
const createDayPatternIntoDB = (payload: ICreateDayPattern) =>
	prisma.$transaction(async (tx) => {
		if (await tx.dayPattern.findUnique({ where: { code: payload.code } }))
			throw new AppError(
				httpStatus.CONFLICT,
				"Day pattern code already exists",
			);
		return tx.dayPattern.create({ data: payload });
	});
const getAllDayPatternsFromDB = async (query: IDayPatternQuery) => {
	const where: Prisma.DayPatternWhereInput = {
		...(query.type ? { type: query.type } : {}),
		...(query.searchTerm
			? { code: { contains: query.searchTerm, mode: "insensitive" } }
			: {}),
	};
	const [data, total] = await prisma.$transaction([
		prisma.dayPattern.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.dayPattern.count({ where }),
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
export const dayPatternService = {
	createDayPatternIntoDB,
	getAllDayPatternsFromDB,
};
