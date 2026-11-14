import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { batchController } from "./batch.controller";
import { batchValidation } from "./batch.validation";
export const batchRoutes = Router();
export const adminBatchRoutes = Router();
batchRoutes.get(
	"/",
	auth(),
	validateQuery(batchValidation.querySchema),
	batchController.getAllBatches,
);
adminBatchRoutes.post(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateRequest(batchValidation.createSchema),
	batchController.createBatch,
);
