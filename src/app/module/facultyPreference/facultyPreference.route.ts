import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { facultyPreferenceController } from "./facultyPreference.controller";
import { facultyPreferenceValidation } from "./facultyPreference.validation";
export const facultyPreferenceRoutes = Router();
export const adminFacultyPreferenceRoutes = Router();
facultyPreferenceRoutes.use(auth(UserRole.FACULTY));
facultyPreferenceRoutes.put(
	"/me",
	validateRequest(facultyPreferenceValidation.replaceSchema),
	facultyPreferenceController.replaceMyPreferences,
);
facultyPreferenceRoutes.get(
	"/me",
	validateQuery(facultyPreferenceValidation.querySchema),
	facultyPreferenceController.getMyPreferences,
);
adminFacultyPreferenceRoutes.get(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateQuery(facultyPreferenceValidation.adminQuerySchema),
	facultyPreferenceController.getAllPreferences,
);
