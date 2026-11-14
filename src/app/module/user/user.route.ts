import { Router, type RequestHandler } from "express";
import httpStatus from "http-status";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { AppError } from "../../utils/AppError";
import { userController } from "./user.controller";
import { userValidation } from "./user.validation";

export const userRoutes = Router();
export const adminUserRoutes = Router();
adminUserRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminUserRoutes.post(
	"/admins",
	validateRequest(userValidation.adminSchema),
	userController.createAdmin,
);
adminUserRoutes.post(
	"/faculties",
	validateRequest(userValidation.facultySchema),
	userController.createFaculty,
);
adminUserRoutes.post(
	"/students",
	validateRequest(userValidation.studentSchema),
	userController.createStudent,
);
adminUserRoutes.post(
	"/import",
	upload.single("file"),
	validateRequest(userValidation.importSchema),
	userController.importUsers,
);
adminUserRoutes.get(
	"/",
	validateQuery(userValidation.querySchema),
	userController.getAllUsers,
);
adminUserRoutes.get(
	"/:id",
	validateParams(userValidation.idSchema),
	userController.getUserById,
);
adminUserRoutes.patch(
	"/:id/status",
	validateParams(userValidation.idSchema),
	validateRequest(userValidation.statusSchema),
	userController.updateUserStatus,
);
adminUserRoutes.delete(
	"/:id",
	validateParams(userValidation.idSchema),
	userController.deleteUser,
);
const parseMultipartData: RequestHandler = (req, _res, next) => {
	try {
		if (req.body.data !== undefined) req.body = JSON.parse(req.body.data);
		next();
	} catch {
		next(new AppError(httpStatus.BAD_REQUEST, "Invalid multipart JSON data"));
	}
};
userRoutes.patch(
	"/me",
	auth(),
	upload.single("photo"),
	parseMultipartData,
	validateRequest(userValidation.profileSchema),
	userController.updateProfile,
);
