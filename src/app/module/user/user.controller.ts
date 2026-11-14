import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userService } from "./user.service";

const updateProfile = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.updateProfileIntoDB(req.user.id, req.body, req.file?.buffer);
	sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Profile updated", data: user });
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.createAdminIntoDB(req.user, req.body);
	sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: "Admin created", data: user });
});
const createFaculty = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.createFacultyIntoDB(req.user, req.body);
	sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: "Faculty created", data: user });
});
const createStudent = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.createStudentIntoDB(req.user, req.body);
	sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: "Student created", data: user });
});

export const userController = { updateProfile, createAdmin, createFaculty, createStudent };
