import { Router, type RequestHandler } from "express";
import httpStatus from "http-status";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppError } from "../../utils/AppError";
import { userController } from "./user.controller";
import { userValidation } from "./user.validation";

export const userRoutes = Router();
export const adminUserRoutes = Router();
adminUserRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminUserRoutes.post("/admins", validateRequest(userValidation.adminSchema), userController.createAdmin);
adminUserRoutes.post("/faculties", validateRequest(userValidation.facultySchema), userController.createFaculty);
adminUserRoutes.post("/students", validateRequest(userValidation.studentSchema), userController.createStudent);
const parseMultipartData: RequestHandler = (req, _res, next) => {
	try { if (req.body.data !== undefined) req.body = JSON.parse(req.body.data); next(); }
	catch { next(new AppError(httpStatus.BAD_REQUEST, "Invalid multipart JSON data")); }
};
userRoutes.patch("/me", auth(), upload.single("photo"), parseMultipartData, validateRequest(userValidation.profileSchema), userController.updateProfile);
