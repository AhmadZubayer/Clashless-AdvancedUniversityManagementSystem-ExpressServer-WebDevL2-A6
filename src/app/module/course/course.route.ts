import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { courseController } from "./course.controller";
import { courseValidation } from "./course.validation";
export const courseRoutes = Router();
export const adminCourseRoutes = Router();
courseRoutes.get(
	"/",
	auth(),
	validateQuery(courseValidation.querySchema),
	courseController.getAllCourses,
);
courseRoutes.get(
	"/:id",
	auth(),
	validateParams(courseValidation.idSchema),
	courseController.getCourseById,
);
adminCourseRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminCourseRoutes.post(
	"/",
	validateRequest(courseValidation.createSchema),
	courseController.createCourse,
);
adminCourseRoutes.patch(
	"/:id",
	validateParams(courseValidation.idSchema),
	validateRequest(courseValidation.updateSchema),
	courseController.updateCourse,
);
adminCourseRoutes.delete(
	"/:id",
	validateParams(courseValidation.idSchema),
	courseController.deleteCourse,
);
adminCourseRoutes.put(
	"/:id/prerequisites",
	validateParams(courseValidation.idSchema),
	validateRequest(courseValidation.prerequisitesSchema),
	courseController.replacePrerequisites,
);
