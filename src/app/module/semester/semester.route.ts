import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { semesterController } from "./semester.controller";
import { semesterValidation } from "./semester.validation";

export const semesterRoutes = Router();
export const adminSemesterRoutes = Router();
semesterRoutes.get("/current", auth(), semesterController.getCurrentSemester);
semesterRoutes.get(
	"/",
	auth(),
	validateQuery(semesterValidation.querySchema),
	semesterController.getAllSemesters,
);
adminSemesterRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminSemesterRoutes.post(
	"/",
	validateRequest(semesterValidation.createSchema),
	semesterController.createSemester,
);
adminSemesterRoutes.get(
	"/:id",
	validateParams(semesterValidation.idSchema),
	semesterController.getSemesterById,
);
adminSemesterRoutes.patch(
	"/:id",
	validateParams(semesterValidation.idSchema),
	validateRequest(semesterValidation.updateSchema),
	semesterController.updateSemester,
);
