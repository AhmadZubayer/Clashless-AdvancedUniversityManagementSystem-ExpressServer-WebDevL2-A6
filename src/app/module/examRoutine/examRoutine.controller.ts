import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { examRoutineService } from "./examRoutine.service";

const generateExamRoutine = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await examRoutineService.requestExamRoutineGenerationIntoDB(
		req.user.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: 202,
		message: "Exam routine generation queued",
		data,
	});
});

const getAllExamRoutines = catchAsync(async (_req: Request, res: Response) => {
	const result = await examRoutineService.getAllExamRoutinesFromDB(
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Exam routine versions retrieved",
		...result,
	});
});

const getExamRoutineById = catchAsync(async (_req: Request, res: Response) => {
	const data = await examRoutineService.getExamRoutineByIdFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Exam routine retrieved",
		data,
	});
});

const moveExamEntry = catchAsync(async (req: Request, res: Response) => {
	const { id, entryId } = res.locals.validatedParams;
	const data = await examRoutineService.moveExamEntryIntoDB(
		id,
		entryId,
		req.body.examSlotId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Exam moved",
		data,
	});
});

const publishExamRoutine = catchAsync(async (_req: Request, res: Response) => {
	const data = await examRoutineService.publishExamRoutineIntoDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Exam routine published",
		data,
	});
});

const getMyExamRoutine = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await examRoutineService.getMyExamRoutineFromDB(req.user);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Your exams retrieved",
		data,
	});
});

export const examRoutineController = {
	generateExamRoutine,
	getAllExamRoutines,
	getExamRoutineById,
	moveExamEntry,
	publishExamRoutine,
	getMyExamRoutine,
};
