import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { ICourseQuery } from "./course.interface";
import { courseService } from "./course.service";

const createCourse = catchAsync(async (req: Request, res: Response) => {
	const data = await courseService.createCourseIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Course created",
		data,
	});
});
const getAllCourses = catchAsync(async (_req: Request, res: Response) => {
	const result = await courseService.getAllCoursesFromDB(
		res.locals.validatedQuery as ICourseQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Courses retrieved",
		...result,
	});
});
const getCourseById = catchAsync(async (_req: Request, res: Response) => {
	const data = await courseService.getCourseByIdFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Course retrieved",
		data,
	});
});
const updateCourse = catchAsync(async (req: Request, res: Response) => {
	const data = await courseService.updateCourseIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Course updated",
		data,
	});
});
const deleteCourse = catchAsync(async (_req: Request, res: Response) => {
	const data = await courseService.deleteCourseFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Course deleted",
		data,
	});
});
const replacePrerequisites = catchAsync(async (req: Request, res: Response) => {
	const data = await courseService.replacePrerequisitesIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Prerequisites replaced",
		data,
	});
});
export const courseController = {
	createCourse,
	getAllCourses,
	getCourseById,
	updateCourse,
	deleteCourse,
	replacePrerequisites,
};
