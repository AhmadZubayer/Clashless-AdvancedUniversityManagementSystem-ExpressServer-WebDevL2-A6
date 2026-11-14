import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateRequest } from "../../middleware/validateRequest";
import { registrationController } from "./registration.controller";
import { registrationValidation } from "./registration.validation";
export const registrationRoutes = Router();
export const adminRegistrationRoutes = Router();
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
