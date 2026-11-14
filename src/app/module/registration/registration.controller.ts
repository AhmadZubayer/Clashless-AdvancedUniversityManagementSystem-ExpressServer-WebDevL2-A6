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
const unselectSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await registrationService.unselectSectionIntoDB(
		req.user.id,
		res.locals.validatedParams.sectionId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section unselected",
		data,
	});
});
const switchSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await registrationService.switchSectionIntoDB(
		req.user.id,
		req.body.fromSectionId,
		req.body.toSectionId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section switched",
		data,
	});
});
export const registrationController = {
	selectSection,
	unselectSection,
	switchSection,
};
