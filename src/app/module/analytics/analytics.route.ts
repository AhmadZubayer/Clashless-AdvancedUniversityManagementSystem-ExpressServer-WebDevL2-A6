import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateQuery } from "../../middleware/validateQuery";
import { analyticsController } from "./analytics.controller";
import { analyticsValidation } from "./analytics.validation";

export const analyticsRoutes = Router();
export const adminAnalyticsRoutes = Router();

analyticsRoutes.get(
	"/me",
	auth(UserRole.FACULTY, UserRole.STUDENT),
	analyticsController.getMyAnalytics,
);

adminAnalyticsRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminAnalyticsRoutes.get(
	"/registration-live",
	analyticsController.getRegistrationLive,
);
adminAnalyticsRoutes.get(
	"/",
	validateQuery(analyticsValidation.querySchema),
	analyticsController.getAdminAnalytics,
);
