import type { Prisma } from "../../../generated/prisma/client";

export type IAuditLogEntry = Prisma.AuditLogUncheckedCreateInput;

export interface IAuditLogQuery {
	entity?: string;
	entityId?: string;
	actorId?: string;
	action?: string;
	from?: Date;
	to?: Date;
	page: number;
	limit: number;
}
