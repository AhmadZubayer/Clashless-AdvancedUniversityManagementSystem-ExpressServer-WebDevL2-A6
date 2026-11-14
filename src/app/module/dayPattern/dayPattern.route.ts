import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { dayPatternController } from "./dayPattern.controller";
import { dayPatternValidation } from "./dayPattern.validation";
export const dayPatternRoutes = Router();
export const adminDayPatternRoutes = Router();
dayPatternRoutes.get(
	"/",
	auth(),
	validateQuery(dayPatternValidation.querySchema),
	dayPatternController.getAllDayPatterns,
);
adminDayPatternRoutes.post(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateRequest(dayPatternValidation.createSchema),
	dayPatternController.createDayPattern,
);
