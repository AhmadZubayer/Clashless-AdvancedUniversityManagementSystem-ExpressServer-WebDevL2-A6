import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { resultService } from "./result.service";
const importResults = catchAsync(async (req: Request, res: Response) => {
	if (!req.file)
		throw new AppError(httpStatus.BAD_REQUEST, "CSV file is required");
	const data = await resultService.importResultsIntoDB(req.file.buffer);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Results imported",
		data,
	});
});
export const resultController = { importResults };
