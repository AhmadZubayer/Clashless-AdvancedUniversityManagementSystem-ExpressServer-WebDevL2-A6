import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userService } from "./user.service";
import type { IUserQuery } from "./user.interface";

const updateProfile = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.updateProfileIntoDB(
		req.user.id,
		req.body,
		req.file?.buffer,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Profile updated",
		data: user,
	});
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.createAdminIntoDB(req.user, req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Admin created",
		data: user,
	});
});
const createFaculty = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.createFacultyIntoDB(req.user, req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Faculty created",
		data: user,
	});
});
const createStudent = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.createStudentIntoDB(req.user, req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Student created",
		data: user,
	});
});

const importUsers = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	if (!req.file)
		throw new AppError(httpStatus.BAD_REQUEST, "CSV file is required");
	const result = await userService.importUsersIntoDB(
		req.user,
		req.body.type,
		req.file.buffer,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Import completed",
		data: result,
	});
});

const getAllUsers = catchAsync(async (_req: Request, res: Response) => {
	const result = await userService.getAllUsersFromDB(
		res.locals.validatedQuery as IUserQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Users retrieved",
		data: result.data,
		meta: result.meta,
	});
});
const getUserById = catchAsync(async (_req: Request, res: Response) => {
	const user = await userService.getUserByIdFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "User retrieved",
		data: user,
	});
});
const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.updateUserStatusIntoDB(
		req.user,
		res.locals.validatedParams.id,
		req.body.status,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "User status updated",
		data: user,
	});
});
const deleteUser = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in");
	const user = await userService.deleteUserFromDB(
		req.user,
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "User deleted",
		data: user,
	});
});

export const userController = {
	updateProfile,
	createAdmin,
	createFaculty,
	createStudent,
	importUsers,
	getAllUsers,
	getUserById,
	updateUserStatus,
	deleteUser,
};
