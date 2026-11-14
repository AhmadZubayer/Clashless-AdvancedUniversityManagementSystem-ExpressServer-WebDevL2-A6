import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { routineController } from "./routine.controller";
import { routineValidation } from "./routine.validation";
export const routineRoutes = Router();
export const adminRoutineRoutes = Router();
adminRoutineRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminRoutineRoutes.get(
	"/",
	validateQuery(routineValidation.listQuerySchema),
	routineController.getAllRoutines,
);
adminRoutineRoutes.post(
	"/generate",
	validateRequest(routineValidation.generateSchema),
	routineController.generateRoutine,
);
adminRoutineRoutes.get(
	"/:id",
	validateParams(routineValidation.idSchema),
	validateQuery(routineValidation.viewQuerySchema),
	routineController.getRoutineById,
);
adminRoutineRoutes.get(
	"/:id/report",
	validateParams(routineValidation.idSchema),
	routineController.getRoutineReport,
);
