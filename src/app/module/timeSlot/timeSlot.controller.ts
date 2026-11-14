import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { ITimeSlotQuery } from "./timeSlot.interface";
import { timeSlotService } from "./timeSlot.service";
const createTimeSlot = catchAsync(async (req: Request, res: Response) => {
	const data = await timeSlotService.createTimeSlotIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Time slot created",
		data,
	});
});
const getAllTimeSlots = catchAsync(async (_req: Request, res: Response) => {
	const result = await timeSlotService.getAllTimeSlotsFromDB(
		res.locals.validatedQuery as ITimeSlotQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Time slots retrieved",
		...result,
	});
});
const updateTimeSlot = catchAsync(async (req: Request, res: Response) => {
	const data = await timeSlotService.updateTimeSlotIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Time slot updated",
		data,
	});
});
export const timeSlotController = {
	createTimeSlot,
	getAllTimeSlots,
	updateTimeSlot,
};
