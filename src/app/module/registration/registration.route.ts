import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateRequest } from "../../middleware/validateRequest";
import { validateQuery } from "../../middleware/validateQuery";
import { registrationController } from "./registration.controller";
import { registrationValidation } from "./registration.validation";
export const registrationRoutes = Router();
export const adminRegistrationRoutes = Router();
adminRegistrationRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminRegistrationRoutes.get(
	"/",
	validateQuery(registrationValidation.adminQuerySchema),
	registrationController.getAllRegistrations,
);
adminRegistrationRoutes.get(
	"/:studentId",
	validateParams(registrationValidation.adminStudentParamsSchema),
	validateQuery(registrationValidation.semesterQuerySchema),
	registrationController.getStudentRegistration,
);
adminRegistrationRoutes.post(
	"/:studentId/sections/:sectionId",
	validateParams(registrationValidation.adminSectionParamsSchema),
	validateRequest(registrationValidation.manualAddSchema),
	registrationController.manuallySelectSection,
);
adminRegistrationRoutes.delete(
	"/:studentId/sections/:sectionId",
	validateParams(registrationValidation.adminSectionParamsSchema),
	validateRequest(registrationValidation.manualRemoveSchema),
	registrationController.manuallyUnselectSection,
);
registrationRoutes.get(
	"/seats/stream",
	auth(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
	registrationController.streamSeats,
);
registrationRoutes.get(
	"/me",
	auth(UserRole.STUDENT),
	registrationController.getMyRegistration,
);
registrationRoutes.get(
	"/offerings",
	auth(UserRole.STUDENT),
	validateQuery(registrationValidation.catalogQuerySchema),
	registrationController.getRegistrationOfferings,
);
registrationRoutes.post(
	"/switch",
	auth(UserRole.STUDENT),
	validateRequest(registrationValidation.switchSchema),
	registrationController.switchSection,
);
registrationRoutes.delete(
	"/sections/:sectionId",
	auth(UserRole.STUDENT),
	validateParams(registrationValidation.sectionParamsSchema),
	registrationController.unselectSection,
);
registrationRoutes.post(
	"/sections/:sectionId",
	auth(UserRole.STUDENT),
	validateParams(registrationValidation.sectionParamsSchema),
	registrationController.selectSection,
);
