import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { facultyPreferenceService } from "./facultyPreference.service";
const replaceMyPreferences = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await facultyPreferenceService.replaceFacultyPreferencesIntoDB(
		req.user.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Preferences replaced",
		data,
	});
});
const getMyPreferences = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const result = await facultyPreferenceService.getFacultyPreferencesFromDB(
		res.locals.validatedQuery,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Preferences retrieved",
		...result,
	});
});
const getAllPreferences = catchAsync(async (_req: Request, res: Response) => {
	const result = await facultyPreferenceService.getFacultyPreferencesFromDB(
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Preferences retrieved",
		...result,
	});
});
export const facultyPreferenceController = {
	replaceMyPreferences,
	getMyPreferences,
	getAllPreferences,
};
