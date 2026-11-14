import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRoomQuery } from "./room.interface";
import { roomService } from "./room.service";
const createRoom = catchAsync(async (req: Request, res: Response) => {
	const data = await roomService.createRoomIntoDB(req.body);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Room created",
		data,
	});
});
const getAllRooms = catchAsync(async (_req: Request, res: Response) => {
	const result = await roomService.getAllRoomsFromDB(
		res.locals.validatedQuery as IRoomQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Rooms retrieved",
		...result,
	});
});
const updateRoom = catchAsync(async (req: Request, res: Response) => {
	const data = await roomService.updateRoomIntoDB(
		res.locals.validatedParams.id,
		req.body,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Room updated",
		data,
	});
});
export const roomController = { createRoom, getAllRooms, updateRoom };
