import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { jobService } from "./job.service";
const getJobById = catchAsync(async (_req: Request, res: Response) => {
	const data = await jobService.getJobByIdFromDB(res.locals.validatedParams.id);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Generation job retrieved",
		data,
	});
});
export const jobController = { getJobById };
