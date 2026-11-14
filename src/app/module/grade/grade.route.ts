import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { gradeController } from "./grade.controller";
import { gradeValidation as v } from "./grade.validation";

export const gradeRoutes = Router();
export const adminGradeRoutes = Router();

gradeRoutes.get("/me", auth(UserRole.STUDENT), gradeController.getMyGrades);
gradeRoutes.put(
	"/sections/:sectionId",
	auth(UserRole.FACULTY),
	validateParams(v.sectionParamsSchema),
	validateRequest(v.submitSchema),
	gradeController.submitGrades,
);
gradeRoutes.get(
	"/sections/:sectionId",
	auth(UserRole.FACULTY, UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateParams(v.sectionParamsSchema),
	gradeController.getSectionGrades,
);

adminGradeRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminGradeRoutes.get(
	"/status",
	validateQuery(v.statusQuerySchema),
	gradeController.getGradeStatus,
);
adminGradeRoutes.post(
	"/publish",
	validateRequest(v.publishSchema),
	gradeController.publishGrades,
);
