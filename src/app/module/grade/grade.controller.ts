import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { gradeService } from "./grade.service";

const user = (req: Request) => {
	if (!req.user) throw new AppError(401, "Please log in");
	return req.user;
};
const reply = (res: Response, message: string, data: unknown) =>
	sendResponse(res, { success: true, statusCode: 200, message, data });

const submitGrades = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Grades saved",
		await gradeService.submitGradesIntoDB(
			res.locals.validatedParams.sectionId,
			user(req),
			req.body,
		),
	),
);
const getSectionGrades = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Grade sheet retrieved",
		await gradeService.getSectionGradesFromDB(
			res.locals.validatedParams.sectionId,
			user(req),
		),
	),
);
const getGradeStatus = catchAsync(async (_req: Request, res: Response) =>
	reply(
		res,
		"Grade status retrieved",
		await gradeService.getGradeStatusFromDB(
			res.locals.validatedQuery.semesterId,
		),
	),
);
const publishGrades = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Results published",
		await gradeService.publishGradesIntoDB(req.body.semesterId, user(req).id),
	),
);
const getMyGrades = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Your results retrieved",
		await gradeService.getMyGradesFromDB(user(req).id),
	),
);

export const gradeController = {
	submitGrades,
	getSectionGrades,
	getGradeStatus,
	publishGrades,
	getMyGrades,
};
