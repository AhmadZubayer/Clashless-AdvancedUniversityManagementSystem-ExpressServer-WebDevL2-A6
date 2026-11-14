import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { registrationController } from "./registration.controller";
import { registrationValidation } from "./registration.validation";
export const registrationRoutes = Router();
export const adminRegistrationRoutes = Router();
registrationRoutes.post(
	"/sections/:sectionId",
	auth(UserRole.STUDENT),
	validateParams(registrationValidation.sectionParamsSchema),
	registrationController.selectSection,
);
