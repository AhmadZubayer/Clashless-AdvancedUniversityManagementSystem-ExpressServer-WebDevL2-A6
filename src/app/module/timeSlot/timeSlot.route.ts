import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { timeSlotController } from "./timeSlot.controller";
import { timeSlotValidation } from "./timeSlot.validation";
export const timeSlotRoutes = Router();
export const adminTimeSlotRoutes = Router();
timeSlotRoutes.get(
	"/",
	auth(),
	validateQuery(timeSlotValidation.querySchema),
	timeSlotController.getAllTimeSlots,
);
adminTimeSlotRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminTimeSlotRoutes.post(
	"/",
	validateRequest(timeSlotValidation.createSchema),
	timeSlotController.createTimeSlot,
);
adminTimeSlotRoutes.patch(
	"/:id",
	validateParams(timeSlotValidation.idSchema),
	validateRequest(timeSlotValidation.updateSchema),
	timeSlotController.updateTimeSlot,
);
