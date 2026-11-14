import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IDayPatternQuery } from "./dayPattern.interface";
import { dayPatternService } from "./dayPattern.service";
const createDayPattern = catchAsync(async (req: Request, res: Response) => {
	const data = await dayPatternService.createDayPatternIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Day pattern created",
		data,
	});
});
const getAllDayPatterns = catchAsync(async (_req: Request, res: Response) => {
	const result = await dayPatternService.getAllDayPatternsFromDB(
		res.locals.validatedQuery as IDayPatternQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Day patterns retrieved",
		...result,
	});
});
export const dayPatternController = { createDayPattern, getAllDayPatterns };
