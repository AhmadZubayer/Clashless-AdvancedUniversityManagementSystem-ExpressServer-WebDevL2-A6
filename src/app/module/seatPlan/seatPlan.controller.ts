import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { seatPlanService } from "./seatPlan.service";

const user = (req: Request) => {
	if (!req.user) throw new AppError(401, "Please log in");
	return req.user;
};
const reply = (
	res: Response,
	message: string,
	data: unknown,
	statusCode = 200,
) => sendResponse(res, { success: true, statusCode, message, data });

const createSeatPlan = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Seat plan created",
		await seatPlanService.createSeatPlanIntoDB(req.body.examSlotId),
		201,
	),
);
const getOverview = catchAsync(async (_req: Request, res: Response) =>
	reply(
		res,
		"Seat plans retrieved",
		await seatPlanService.getSeatPlansOverviewFromDB(
			res.locals.validatedQuery.semesterId,
		),
	),
);
const getLastUsedRooms = catchAsync(async (_req: Request, res: Response) =>
	reply(res, "Rooms retrieved", await seatPlanService.getLastUsedRoomsFromDB()),
);
const setRooms = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Rooms saved",
		await seatPlanService.setRoomsIntoDB(
			res.locals.validatedParams.id,
			req.body.rooms,
		),
	),
);
const generate = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Seat plan generated",
		await seatPlanService.generateSeatPlanIntoDB(
			res.locals.validatedParams.id,
			req.body.orderBy,
		),
	),
);
const getSummary = catchAsync(async (_req: Request, res: Response) =>
	reply(
		res,
		"Seat plan retrieved",
		await seatPlanService.getSeatPlanSummaryFromDB(
			res.locals.validatedParams.id,
		),
	),
);
const getRoomGrid = catchAsync(async (req: Request, res: Response) => {
	const { id, roomId } = res.locals.validatedParams;
	reply(
		res,
		"Room retrieved",
		await seatPlanService.getRoomGridFromDB(id, roomId, user(req)),
	);
});
const swap = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Seats swapped",
		await seatPlanService.swapSeatsIntoDB(
			res.locals.validatedParams.id,
			user(req).id,
			req.body.seatAId,
			req.body.seatBId,
		),
	),
);
const addStudent = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Student seated",
		await seatPlanService.addLateStudentIntoDB(
			res.locals.validatedParams.id,
			user(req).id,
			req.body.studentId,
		),
		201,
	),
);
const publish = catchAsync(async (_req: Request, res: Response) =>
	reply(
		res,
		"Seat plan published",
		await seatPlanService.publishSeatPlanIntoDB(res.locals.validatedParams.id),
	),
);
const exportPdf = catchAsync(async (_req: Request, res: Response) => {
	const pdf = await seatPlanService.exportSeatPlanFromDB(
		res.locals.validatedParams.id,
		res.locals.validatedQuery.type,
	);
	res
		.status(200)
		.type("application/pdf")
		.setHeader("Content-Disposition", 'inline; filename="seat-plan.pdf"')
		.send(pdf);
});
const autoAssign = catchAsync(async (_req: Request, res: Response) =>
	reply(
		res,
		"Invigilators assigned",
		await seatPlanService.autoAssignInvigilatorsIntoDB(
			res.locals.validatedParams.id,
		),
	),
);
const setInvigilators = catchAsync(async (req: Request, res: Response) => {
	const { id, roomId } = res.locals.validatedParams;
	reply(
		res,
		"Invigilators saved",
		await seatPlanService.setRoomInvigilatorsIntoDB(
			id,
			roomId,
			req.body.facultyIds,
		),
	);
});
const getMySeats = catchAsync(async (req: Request, res: Response) =>
	reply(
		res,
		"Your seats retrieved",
		await seatPlanService.getMySeatsFromDB(user(req).id),
	),
);

export const seatPlanController = {
	createSeatPlan,
	getOverview,
	getLastUsedRooms,
	setRooms,
	generate,
	getSummary,
	getRoomGrid,
	swap,
	addStudent,
	publish,
	exportPdf,
	autoAssign,
	setInvigilators,
	getMySeats,
};
