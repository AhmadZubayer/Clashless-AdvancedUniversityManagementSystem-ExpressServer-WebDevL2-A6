import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IProgramQuery } from "./program.interface";
import { programService } from "./program.service";

const createProgram = catchAsync(async (req: Request, res: Response) => {
	const data = await programService.createProgramIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Program created",
		data,
	});
});
const getAllPrograms = catchAsync(async (_req: Request, res: Response) => {
	const result = await programService.getAllProgramsFromDB(
		res.locals.validatedQuery as IProgramQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Programs retrieved",
		...result,
	});
});
const getProgramById = catchAsync(async (_req: Request, res: Response) => {
	const data = await programService.getProgramByIdFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Program retrieved",
		data,
	});
});
const updateProgram = catchAsync(async (req: Request, res: Response) => {
	const data = await programService.updateProgramIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Program updated",
		data,
	});
});
const replaceCurriculum = catchAsync(async (req: Request, res: Response) => {
	const data = await programService.replaceCurriculumIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Curriculum replaced",
		data,
	});
});
export const programController = {
	createProgram,
	getAllPrograms,
	getProgramById,
	updateProgram,
	replaceCurriculum,
};
