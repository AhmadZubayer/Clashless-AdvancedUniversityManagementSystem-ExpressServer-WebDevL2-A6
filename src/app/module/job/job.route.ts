import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { jobController } from "./job.controller";
import { jobValidation } from "./job.validation";
export const adminJobRoutes = Router();
adminJobRoutes.get(
	"/:id",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateParams(jobValidation.idSchema),
	jobController.getJobById,
);
