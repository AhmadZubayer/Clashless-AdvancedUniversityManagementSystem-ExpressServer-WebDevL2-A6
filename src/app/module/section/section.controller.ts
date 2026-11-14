import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { sectionService } from "./section.service";

const createSection = catchAsync(async (req: Request, res: Response) => {
	const data = await sectionService.createSectionIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: 201,
		message: "Section created",
		data,
	});
});
const updateSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.updateSectionIntoDB(
		res.locals.validatedParams.id,
		req.body,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section updated",
		data,
	});
});
const rescheduleSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.rescheduleSectionIntoDB(
		res.locals.validatedParams.id,
		req.body,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section rescheduled",
		data,
	});
});
const cancelSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.cancelSectionIntoDB(
		res.locals.validatedParams.id,
		req.body.reason,
		req.user.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section cancelled",
		data,
	});
});
const assignFaculty = catchAsync(async (req: Request, res: Response) => {
	const data = await sectionService.assignFacultyIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Teachers assigned",
		data,
	});
});
const getMySections = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await sectionService.getMySectionsFromDB(req.user.id);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "My sections retrieved",
		data,
	});
});
const getSectionStudents = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const { format } = res.locals.validatedQuery as {
		format: "json" | "csv" | "pdf";
	};
	const result = await sectionService.getSectionStudentsFromDB(
		res.locals.validatedParams.id,
		req.user,
		format,
	);
	if (result.buffer) {
		res.type(format === "csv" ? "text/csv" : "application/pdf");
		res.attachment(`class-list-${res.locals.validatedParams.id}.${format}`);
		res.send(result.buffer);
		return;
	}
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Class list retrieved",
		data: result.students,
	});
});
export const sectionController = {
	getSectionStudents,
	assignFaculty,
	getMySections,
	createSection,
	updateSection,
	rescheduleSection,
	cancelSection,
};
