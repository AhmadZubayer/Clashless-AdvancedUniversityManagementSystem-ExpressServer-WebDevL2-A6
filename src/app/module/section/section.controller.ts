import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { sectionService } from "./section.service";

const createSection = catchAsync(async (req: Request, res: Response) => {
	const data = await sectionService.createSectionIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: 201,
		message: "Section created",
		data,
	});
});
const updateSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.updateSectionIntoDB(
		res.locals.validatedParams.id,
		req.body,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section updated",
		data,
	});
});
const rescheduleSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.rescheduleSectionIntoDB(
		res.locals.validatedParams.id,
		req.body,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section rescheduled",
		data,
	});
});
const cancelSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.cancelSectionIntoDB(
		res.locals.validatedParams.id,
		req.body.reason,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section cancelled",
		data,
	});
});
export const sectionController = {
	createSection,
	updateSection,
	rescheduleSection,
	cancelSection,
};
