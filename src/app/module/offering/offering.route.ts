import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { offeringController } from "./offering.controller";
import { offeringValidation } from "./offering.validation";
export const offeringRoutes = Router();
export const adminOfferingRoutes = Router();
offeringRoutes.get(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FACULTY),
	validateQuery(offeringValidation.querySchema),
	offeringController.getAllOfferings,
);
adminOfferingRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminOfferingRoutes.post(
	"/",
	validateRequest(offeringValidation.createSchema),
	offeringController.createOffering,
);
adminOfferingRoutes.delete(
	"/:id",
	validateParams(offeringValidation.idSchema),
	offeringController.deleteOffering,
);
