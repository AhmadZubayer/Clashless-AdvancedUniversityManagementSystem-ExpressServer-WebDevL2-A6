import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { paymentService } from "./payment.service";

const currentUser = (req: Request) => {
	if (!req.user)
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Please log in to access this resource",
		);
	return req.user;
};

const createPayment = catchAsync(async (req: Request, res: Response) => {
	const result = await paymentService.createPaymentIntoDB(
		currentUser(req).id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Payment checkout session created successfully",
		data: result,
	});
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	const payments = await paymentService.getMyPaymentsFromDB(
		currentUser(req).id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Payments retrieved successfully",
		data: payments,
	});
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const payment = await paymentService.getPaymentByIdFromDB(
		res.locals.validatedParams.id,
		currentUser(req),
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Payment retrieved successfully",
		data: payment,
	});
});

const getReceipt = catchAsync(async (req: Request, res: Response) => {
	const pdf = await paymentService.getReceiptPdfFromDB(
		res.locals.validatedParams.id,
		currentUser(req),
	);
	res
		.status(httpStatus.OK)
		.type("application/pdf")
		.setHeader("Content-Disposition", 'inline; filename="receipt.pdf"')
		.send(pdf);
});

const getAllPayments = catchAsync(async (_req: Request, res: Response) => {
	const result = await paymentService.getAllPaymentsFromDB(
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Payments retrieved successfully",
		...result,
	});
});

export const paymentController = {
	createPayment,
	getMyPayments,
	getPaymentById,
	getReceipt,
	getAllPayments,
};
