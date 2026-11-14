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
routineRoutes.get(
	"/published/export",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FACULTY),
	validateQuery(routineValidation.exportQuerySchema),
	routineController.exportPublishedRoutine,
);
routineRoutes.get(
	"/published",
	auth(),
	validateQuery(routineValidation.publishedQuerySchema),
	routineController.getPublishedRoutine,
);
routineRoutes.get(
	"/me",
	auth(UserRole.STUDENT, UserRole.FACULTY),
	routineController.getMyRoutine,
);
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
adminRoutineRoutes.get(
	"/:id/export",
	validateParams(routineValidation.idSchema),
	validateQuery(routineValidation.exportQuerySchema),
	routineController.exportRoutineVersion,
);
adminRoutineRoutes.post(
	"/:id/publish",
	validateParams(routineValidation.idSchema),
	routineController.publishRoutine,
);
adminRoutineRoutes.patch(
	"/:id/entries/:entryId",
	validateParams(routineValidation.entryParamsSchema),
	validateRequest(routineValidation.moveSchema),
	routineController.moveRoutineEntry,
);
adminRoutineRoutes.post(
	"/:id/entries/swap",
	validateParams(routineValidation.idSchema),
	validateRequest(routineValidation.swapSchema),
	routineController.swapRoutineEntries,
);
adminRoutineRoutes.patch(
	"/:id/entries/:entryId/pin",
	validateParams(routineValidation.entryParamsSchema),
	routineController.toggleRoutineEntryPin,
);
