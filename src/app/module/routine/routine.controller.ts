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
const getAllRoutines = catchAsync(async (_req: Request, res: Response) => {
	const result = await routineService.getAllRoutinesFromDB(
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Routine versions retrieved",
		...result,
	});
});
const getRoutineById = catchAsync(async (_req: Request, res: Response) => {
	const data = await routineService.getRoutineByIdFromDB(
		res.locals.validatedParams.id,
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Routine retrieved",
		data,
	});
});
const getRoutineReport = catchAsync(async (_req: Request, res: Response) => {
	const data = await routineService.getRoutineReportFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Routine report retrieved",
		data,
	});
});
const moveRoutineEntry = catchAsync(async (req: Request, res: Response) => {
	const { id, entryId } = res.locals.validatedParams;
	const data = await routineService.moveRoutineEntryIntoDB(
		id,
		entryId,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Routine entry moved",
		data,
	});
});
const swapRoutineEntries = catchAsync(async (req: Request, res: Response) => {
	const data = await routineService.swapRoutineEntriesIntoDB(
		res.locals.validatedParams.id,
		req.body.entryAId,
		req.body.entryBId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Routine entries swapped",
		data,
	});
});
const toggleRoutineEntryPin = catchAsync(
	async (_req: Request, res: Response) => {
		const { id, entryId } = res.locals.validatedParams;
		const data = await routineService.toggleRoutineEntryPinIntoDB(id, entryId);
		sendResponse(res, {
			success: true,
			statusCode: 200,
			message: "Routine pin toggled",
			data,
		});
	},
);
const publishRoutine = catchAsync(async (_req: Request, res: Response) => {
	const data = await routineService.publishRoutineIntoDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Routine published",
		data,
	});
});
const getPublishedRoutine = catchAsync(async (_req: Request, res: Response) => {
	const data = await routineService.getPublishedRoutineFromDB(
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Published routine retrieved",
		data,
	});
});
const getMyRoutine = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await routineService.getMyRoutineFromDB(req.user);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "My weekly routine retrieved",
		data,
	});
});
const exportPublishedRoutine = catchAsync(
	async (req: Request, res: Response) => {
		if (!req.user) throw new AppError(401, "Please log in");
		const buffer = await routineService.exportRoutineFromDB(
			req.user,
			res.locals.validatedQuery,
		);
		res
			.type("application/pdf")
			.attachment("published-routine.pdf")
			.send(buffer);
	},
);
const exportRoutineVersion = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const buffer = await routineService.exportRoutineFromDB(
		req.user,
		res.locals.validatedQuery,
		res.locals.validatedParams.id,
	);
	res
		.type("application/pdf")
		.attachment(`routine-${res.locals.validatedParams.id}.pdf`)
		.send(buffer);
});
export const routineController = {
	getPublishedRoutine,
	getMyRoutine,
	exportPublishedRoutine,
	exportRoutineVersion,
	publishRoutine,
	moveRoutineEntry,
	swapRoutineEntries,
	toggleRoutineEntryPin,
	generateRoutine,
	getAllRoutines,
	getRoutineById,
	getRoutineReport,
};
