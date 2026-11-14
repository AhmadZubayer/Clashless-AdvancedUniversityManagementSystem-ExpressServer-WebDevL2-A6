import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { ISemesterQuery } from "./semester.interface";
import { semesterService } from "./semester.service";

const createSemester = catchAsync(async (req: Request, res: Response) => {
	const data = await semesterService.createSemesterIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Semester created",
		data,
	});
});
const getAllSemesters = catchAsync(async (_req: Request, res: Response) => {
	const result = await semesterService.getAllSemestersFromDB(
		res.locals.validatedQuery as ISemesterQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Semesters retrieved",
		...result,
	});
});
const getCurrentSemester = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const data = await semesterService.getCurrentSemesterFromDB(req.user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Current semester retrieved",
		data,
	});
});
const getSemesterById = catchAsync(async (_req: Request, res: Response) => {
	const data = await semesterService.getSemesterByIdFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Semester retrieved",
		data,
	});
});
const updateSemester = catchAsync(async (req: Request, res: Response) => {
	const data = await semesterService.updateSemesterIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Semester updated",
		data,
	});
});
const changeSemesterPhase = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const data = await semesterService.changeSemesterPhaseIntoDB(
		req.user,
		res.locals.validatedParams.id,
		req.body.phase,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Semester phase changed",
		data,
	});
});

export const semesterController = {
	changeSemesterPhase,
	createSemester,
	getAllSemesters,
	getCurrentSemester,
	getSemesterById,
	updateSemester,
};
