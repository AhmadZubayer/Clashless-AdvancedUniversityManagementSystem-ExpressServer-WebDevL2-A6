import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IBatchQuery } from "./batch.interface";
import { batchService } from "./batch.service";

const createBatch = catchAsync(async (req: Request, res: Response) => {
	const data = await batchService.createBatchIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Batch created",
		data,
	});
});
const getAllBatches = catchAsync(async (_req: Request, res: Response) => {
	const result = await batchService.getAllBatchesFromDB(
		res.locals.validatedQuery as IBatchQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Batches retrieved",
		...result,
	});
});
export const batchController = { createBatch, getAllBatches };
