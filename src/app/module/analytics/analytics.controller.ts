import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { analyticsService } from "./analytics.service";

const getAdminAnalytics = catchAsync(async (_req: Request, res: Response) => {
	const data = await analyticsService.getAdminAnalyticsFromDB(
		res.locals.validatedQuery.semesterId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Dashboard retrieved",
		data,
	});
});

const getRegistrationLive = catchAsync(async (_req: Request, res: Response) => {
	const data = await analyticsService.getRegistrationLiveFromDB();
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Live registration view retrieved",
		data,
	});
});

const getMyAnalytics = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await analyticsService.getMyAnalyticsFromDB(req.user);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Dashboard retrieved",
		data,
	});
});

export const analyticsController = {
	getAdminAnalytics,
	getRegistrationLive,
	getMyAnalytics,
};
