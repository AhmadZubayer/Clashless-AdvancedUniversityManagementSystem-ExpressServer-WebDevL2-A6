import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { seatPlanController } from "./seatPlan.controller";
import { seatPlanValidation as v } from "./seatPlan.validation";

export const seatPlanRoutes = Router();
export const adminSeatPlanRoutes = Router();

seatPlanRoutes.get(
	"/me",
	auth(UserRole.STUDENT),
	seatPlanController.getMySeats,
);
seatPlanRoutes.get(
	"/:id/rooms/:roomId",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FACULTY),
	validateParams(v.roomParamsSchema),
	seatPlanController.getRoomGrid,
);

adminSeatPlanRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminSeatPlanRoutes.post(
	"/",
	validateRequest(v.createSchema),
	seatPlanController.createSeatPlan,
);
adminSeatPlanRoutes.get(
	"/",
	validateQuery(v.overviewQuerySchema),
	seatPlanController.getOverview,
);
adminSeatPlanRoutes.get(
	"/rooms/last-used",
	seatPlanController.getLastUsedRooms,
);
adminSeatPlanRoutes.put(
	"/:id/rooms/:roomId/invigilators",
	validateParams(v.roomParamsSchema),
	validateRequest(v.invigilatorsSchema),
	seatPlanController.setInvigilators,
);
adminSeatPlanRoutes.put(
	"/:id/rooms",
	validateParams(v.idSchema),
	validateRequest(v.roomsSchema),
	seatPlanController.setRooms,
);
adminSeatPlanRoutes.post(
	"/:id/generate",
	validateParams(v.idSchema),
	validateRequest(v.generateSchema),
	seatPlanController.generate,
);
adminSeatPlanRoutes.post(
	"/:id/swap",
	validateParams(v.idSchema),
	validateRequest(v.swapSchema),
	seatPlanController.swap,
);
adminSeatPlanRoutes.post(
	"/:id/students",
	validateParams(v.idSchema),
	validateRequest(v.studentSchema),
	seatPlanController.addStudent,
);
adminSeatPlanRoutes.post(
	"/:id/publish",
	validateParams(v.idSchema),
	seatPlanController.publish,
);
adminSeatPlanRoutes.get(
	"/:id/export",
	validateParams(v.idSchema),
	validateQuery(v.exportQuerySchema),
	seatPlanController.exportPdf,
);
adminSeatPlanRoutes.post(
	"/:id/invigilators/auto-assign",
	validateParams(v.idSchema),
	seatPlanController.autoAssign,
);
adminSeatPlanRoutes.get(
	"/:id",
	validateParams(v.idSchema),
	seatPlanController.getSummary,
);
