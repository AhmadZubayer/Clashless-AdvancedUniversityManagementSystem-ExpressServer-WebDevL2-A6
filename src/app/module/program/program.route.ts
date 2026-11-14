import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { programController } from "./program.controller";
import { programValidation } from "./program.validation";

export const programRoutes = Router();
export const adminProgramRoutes = Router();
programRoutes.get(
	"/",
	auth(),
	validateQuery(programValidation.querySchema),
	programController.getAllPrograms,
);
programRoutes.get(
	"/:id",
	auth(),
	validateParams(programValidation.idSchema),
	programController.getProgramById,
);
adminProgramRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminProgramRoutes.post(
	"/",
	validateRequest(programValidation.createSchema),
	programController.createProgram,
);
adminProgramRoutes.patch(
	"/:id",
	validateParams(programValidation.idSchema),
	validateRequest(programValidation.updateSchema),
	programController.updateProgram,
);
adminProgramRoutes.put(
	"/:id/curriculum",
	validateParams(programValidation.idSchema),
	validateRequest(programValidation.curriculumSchema),
	programController.replaceCurriculum,
);
