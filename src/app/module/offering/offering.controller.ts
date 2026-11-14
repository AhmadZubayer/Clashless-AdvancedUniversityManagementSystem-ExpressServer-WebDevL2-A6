import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IOfferingQuery } from "./offering.interface";
import { offeringService } from "./offering.service";
const createOffering = catchAsync(async (req: Request, res: Response) => {
	const data = await offeringService.createOfferingIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Course offered",
		data,
	});
});
const getAllOfferings = catchAsync(async (_req: Request, res: Response) => {
	const result = await offeringService.getAllOfferingsFromDB(
		res.locals.validatedQuery as IOfferingQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Offerings retrieved",
		...result,
	});
});
const deleteOffering = catchAsync(async (_req: Request, res: Response) => {
	const data = await offeringService.deleteOfferingFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Offering removed",
		data,
	});
});
export const offeringController = {
	createOffering,
	getAllOfferings,
	deleteOffering,
};
