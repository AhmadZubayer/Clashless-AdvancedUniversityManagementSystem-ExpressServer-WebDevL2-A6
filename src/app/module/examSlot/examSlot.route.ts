import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { examSlotController } from "./examSlot.controller";
import { examSlotValidation } from "./examSlot.validation";

export const examSlotRoutes = Router();
export const adminExamSlotRoutes = Router();

examSlotRoutes.get(
	"/",
	auth(),
	validateQuery(examSlotValidation.querySchema),
	examSlotController.getExamSlots,
);

adminExamSlotRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminExamSlotRoutes.post(
	"/",
	validateRequest(examSlotValidation.createSchema),
	examSlotController.createExamSlots,
);
adminExamSlotRoutes.delete(
	"/:id",
	validateParams(examSlotValidation.idSchema),
	examSlotController.deleteExamSlot,
);
