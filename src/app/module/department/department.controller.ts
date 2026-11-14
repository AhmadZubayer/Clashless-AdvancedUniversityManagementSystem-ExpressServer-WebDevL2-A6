import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IDepartmentQuery } from "./department.interface";
import { departmentService } from "./department.service";

const createDepartment = catchAsync(async (req: Request, res: Response) => {
	const data = await departmentService.createDepartmentIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Department created",
		data,
	});
});
const getAllDepartments = catchAsync(async (_req: Request, res: Response) => {
	const result = await departmentService.getAllDepartmentsFromDB(
		res.locals.validatedQuery as IDepartmentQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Departments retrieved",
		...result,
	});
});
const updateDepartment = catchAsync(async (req: Request, res: Response) => {
	const data = await departmentService.updateDepartmentIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Department updated",
		data,
	});
});
const deleteDepartment = catchAsync(async (_req: Request, res: Response) => {
	const data = await departmentService.deleteDepartmentFromDB(
		res.locals.validatedParams.id,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Department deleted",
		data,
	});
});
export const departmentController = {
	createDepartment,
	getAllDepartments,
	updateDepartment,
	deleteDepartment,
};
