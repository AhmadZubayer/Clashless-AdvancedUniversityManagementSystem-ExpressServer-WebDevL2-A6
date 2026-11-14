import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { examRoutineController } from "./examRoutine.controller";
import { examRoutineValidation } from "./examRoutine.validation";

export const examRoutineRoutes = Router();
export const adminExamRoutineRoutes = Router();

examRoutineRoutes.get(
	"/me",
	auth(UserRole.STUDENT, UserRole.FACULTY),
	examRoutineController.getMyExamRoutine,
);

adminExamRoutineRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminExamRoutineRoutes.get(
	"/",
	validateQuery(examRoutineValidation.listQuerySchema),
	examRoutineController.getAllExamRoutines,
);
adminExamRoutineRoutes.post(
	"/generate",
	validateRequest(examRoutineValidation.generateSchema),
	examRoutineController.generateExamRoutine,
);
adminExamRoutineRoutes.get(
	"/:id",
	validateParams(examRoutineValidation.idSchema),
	examRoutineController.getExamRoutineById,
);
adminExamRoutineRoutes.patch(
	"/:id/entries/:entryId",
	validateParams(examRoutineValidation.entryParamsSchema),
	validateRequest(examRoutineValidation.moveSchema),
	examRoutineController.moveExamEntry,
);
adminExamRoutineRoutes.post(
	"/:id/publish",
	validateParams(examRoutineValidation.idSchema),
	examRoutineController.publishExamRoutine,
);
