import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { resultController } from "./result.controller";
import { resultValidation } from "./result.validation";
export const adminResultRoutes = Router();
adminResultRoutes.post(
	"/import",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	upload.single("file"),
	validateRequest(resultValidation.importSchema),
	resultController.importResults,
);
