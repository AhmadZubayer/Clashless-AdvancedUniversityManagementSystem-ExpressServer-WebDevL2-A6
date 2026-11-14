import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateQuery } from "../../middleware/validateQuery";
import { auditLogController } from "./auditLog.controller";
import { auditLogValidation } from "./auditLog.validation";

export const adminAuditLogRoutes = Router();

adminAuditLogRoutes.get(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateQuery(auditLogValidation.querySchema),
	auditLogController.getAuditLogs,
);
