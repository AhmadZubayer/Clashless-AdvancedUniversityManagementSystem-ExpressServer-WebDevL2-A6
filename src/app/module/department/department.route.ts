import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { departmentController } from "./department.controller";
import { departmentValidation } from "./department.validation";

export const departmentRoutes = Router();
export const adminDepartmentRoutes = Router();
departmentRoutes.get(
	"/",
	auth(),
	validateQuery(departmentValidation.querySchema),
	departmentController.getAllDepartments,
);
adminDepartmentRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminDepartmentRoutes.post(
	"/",
	validateRequest(departmentValidation.createSchema),
	departmentController.createDepartment,
);
adminDepartmentRoutes.patch(
	"/:id",
	validateParams(departmentValidation.idSchema),
	validateRequest(departmentValidation.updateSchema),
	departmentController.updateDepartment,
);
adminDepartmentRoutes.delete(
	"/:id",
	validateParams(departmentValidation.idSchema),
	departmentController.deleteDepartment,
);
