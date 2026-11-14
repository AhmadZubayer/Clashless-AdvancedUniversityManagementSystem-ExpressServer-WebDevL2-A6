import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { registrationService } from "./registration.service";
const selectSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const result = await registrationService.selectSectionIntoDB(
		req.user.id,
		res.locals.validatedParams.sectionId,
	);
	sendResponse(res, { success: true, message: "Section selected", ...result });
});
export const registrationController = { selectSection };
