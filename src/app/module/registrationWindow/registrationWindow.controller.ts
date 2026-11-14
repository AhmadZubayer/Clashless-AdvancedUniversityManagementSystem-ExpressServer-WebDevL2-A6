import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRegistrationWindowQuery } from "./registrationWindow.interface";
import { registrationWindowService } from "./registrationWindow.service";
const createRegistrationWindow = catchAsync(
	async (req: Request, res: Response) => {
		const data = await registrationWindowService.createRegistrationWindowIntoDB(
			req.body,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.CREATED,
			message: "Registration window created",
			data,
		});
	},
);
const getAllRegistrationWindows = catchAsync(
	async (req: Request, res: Response) => {
		if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
		const result =
			await registrationWindowService.getAllRegistrationWindowsFromDB(
				req.user,
				res.locals.validatedQuery as IRegistrationWindowQuery,
			);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Registration windows retrieved",
			...result,
		});
	},
);
const updateRegistrationWindow = catchAsync(
	async (req: Request, res: Response) => {
		if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
		const data = await registrationWindowService.updateRegistrationWindowIntoDB(
			req.user,
			res.locals.validatedParams.id,
			req.body,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Registration window updated",
			data,
		});
	},
);
const deleteRegistrationWindow = catchAsync(
	async (_req: Request, res: Response) => {
		const data = await registrationWindowService.deleteRegistrationWindowFromDB(
			res.locals.validatedParams.id,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Registration window deleted",
			data,
		});
	},
);
export const registrationWindowController = {
	createRegistrationWindow,
	getAllRegistrationWindows,
	updateRegistrationWindow,
	deleteRegistrationWindow,
};
