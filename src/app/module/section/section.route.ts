import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { sectionController } from "./section.controller";
import { sectionValidation } from "./section.validation";

export const sectionRoutes = Router();
export const adminSectionRoutes = Router();
sectionRoutes.get(
	"/mine",
	auth(UserRole.FACULTY),
	sectionController.getMySections,
);
sectionRoutes.get(
	"/:id/students",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FACULTY),
	validateParams(sectionValidation.idSchema),
	validateQuery(sectionValidation.studentsQuerySchema),
	sectionController.getSectionStudents,
);
adminSectionRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminSectionRoutes.put(
	"/faculty-assignments",
	validateRequest(sectionValidation.assignmentsSchema),
	sectionController.assignFaculty,
);
adminSectionRoutes.post(
	"/",
	validateRequest(sectionValidation.createSchema),
	sectionController.createSection,
);
adminSectionRoutes.patch(
	"/:id",
	validateParams(sectionValidation.idSchema),
	validateRequest(sectionValidation.updateSchema),
	sectionController.updateSection,
);
adminSectionRoutes.patch(
	"/:id/schedule",
	validateParams(sectionValidation.idSchema),
	validateRequest(sectionValidation.rescheduleSchema),
	sectionController.rescheduleSection,
);
adminSectionRoutes.post(
	"/:id/cancel",
	validateParams(sectionValidation.idSchema),
	validateRequest(sectionValidation.cancelSchema),
	sectionController.cancelSection,
);
