import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { routineService } from "./routine.service";
const generateRoutine = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await routineService.requestRoutineGenerationIntoDB(
		req.user.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: 202,
		message: "Routine generation queued",
		data,
	});
});
export const routineController = { generateRoutine };
