import type { Prisma } from "../../../generated/prisma/client";
import type { IAuditLogEntry } from "./auditLog.interface";

export const createAuditLogIntoDB = (
	tx: Prisma.TransactionClient,
	entry: IAuditLogEntry,
) => tx.auditLog.create({ data: entry });
export const auditLogService = { createAuditLogIntoDB };
