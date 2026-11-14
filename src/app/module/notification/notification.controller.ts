import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { notificationService } from "./notification.service";

const userId = (req: Request) => {
	if (!req.user) throw new AppError(401, "Please log in");
	return req.user.id;
};

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
	const result = await notificationService.getMyNotificationsFromDB(
		userId(req),
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Notifications retrieved",
		...result,
	});
});

const markAllRead = catchAsync(async (req: Request, res: Response) => {
	const data = await notificationService.markAllReadIntoDB(userId(req));
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "All notifications marked as read",
		data,
	});
});

const markOneRead = catchAsync(async (req: Request, res: Response) => {
	const data = await notificationService.markOneReadIntoDB(
		userId(req),
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Notification marked as read",
		data,
	});
});

export const notificationController = {
	getMyNotifications,
	markAllRead,
	markOneRead,
};
