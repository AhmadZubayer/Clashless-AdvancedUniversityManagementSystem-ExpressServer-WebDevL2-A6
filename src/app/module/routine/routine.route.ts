import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { routineController } from "./routine.controller";
import { routineValidation } from "./routine.validation";
export const routineRoutes = Router();
export const adminRoutineRoutes = Router();
adminRoutineRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminRoutineRoutes.post(
	"/generate",
	validateRequest(routineValidation.generateSchema),
	routineController.generateRoutine,
);
