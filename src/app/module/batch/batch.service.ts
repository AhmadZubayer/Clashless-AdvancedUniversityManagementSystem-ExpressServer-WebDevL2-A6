import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateBatch, IBatchQuery } from "./batch.interface";

const createBatchIntoDB = ({ code }: ICreateBatch) =>
	prisma.$transaction(async (tx) => {
		if (await tx.batch.findUnique({ where: { code } }))
			throw new AppError(httpStatus.CONFLICT, "Batch code already exists");
		return tx.batch.create({
			data: {
				code,
				intakeYear: 2000 + Number(code.slice(0, 2)),
				intakeTerm: Number(code.slice(3)),
			},
		});
	});
const getAllBatchesFromDB = async (query: IBatchQuery) => {
	const where: Prisma.BatchWhereInput = query.searchTerm
		? { code: { contains: query.searchTerm, mode: "insensitive" } }
		: {};
	const [data, total] = await prisma.$transaction([
		prisma.batch.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.batch.count({ where }),
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
export const batchService = { createBatchIntoDB, getAllBatchesFromDB };
