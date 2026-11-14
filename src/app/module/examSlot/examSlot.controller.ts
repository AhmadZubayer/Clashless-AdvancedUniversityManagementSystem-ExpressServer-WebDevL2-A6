import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { examSlotService } from "./examSlot.service";

const createExamSlots = catchAsync(async (req: Request, res: Response) => {
	const data = await examSlotService.createExamSlotsIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: 201,
		message: "Exam slots created",
		data,
	});
});

const getExamSlots = catchAsync(async (_req: Request, res: Response) => {
	const data = await examSlotService.getExamSlotsFromDB(
		res.locals.validatedQuery.semesterId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Exam slots retrieved",
		data,
	});
});

const deleteExamSlot = catchAsync(async (_req: Request, res: Response) => {
	const data = await examSlotService.deleteExamSlotIntoDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Exam slot removed",
		data,
	});
});

export const examSlotController = {
	createExamSlots,
	getExamSlots,
	deleteExamSlot,
};
