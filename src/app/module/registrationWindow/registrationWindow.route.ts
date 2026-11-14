import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { registrationWindowController } from "./registrationWindow.controller";
import { registrationWindowValidation } from "./registrationWindow.validation";
export const registrationWindowRoutes = Router();
export const adminRegistrationWindowRoutes = Router();
registrationWindowRoutes.get(
	"/",
	auth(),
	validateQuery(registrationWindowValidation.querySchema),
	registrationWindowController.getAllRegistrationWindows,
);
adminRegistrationWindowRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminRegistrationWindowRoutes.post(
	"/",
	validateRequest(registrationWindowValidation.createSchema),
	registrationWindowController.createRegistrationWindow,
);
adminRegistrationWindowRoutes.patch(
	"/:id",
	validateParams(registrationWindowValidation.idSchema),
	validateRequest(registrationWindowValidation.updateSchema),
	registrationWindowController.updateRegistrationWindow,
);
adminRegistrationWindowRoutes.delete(
	"/:id",
	validateParams(registrationWindowValidation.idSchema),
	registrationWindowController.deleteRegistrationWindow,
);
