import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { IAuditLogEntry, IAuditLogQuery } from "./auditLog.interface";

export const createAuditLogIntoDB = (
	tx: Prisma.TransactionClient,
	entry: IAuditLogEntry,
) => tx.auditLog.create({ data: entry });

const getAuditLogsFromDB = async (query: IAuditLogQuery) => {
	const where: Prisma.AuditLogWhereInput = {
		...(query.entity ? { entity: query.entity } : {}),
		...(query.entityId ? { entityId: query.entityId } : {}),
		...(query.actorId ? { actorId: query.actorId } : {}),
		...(query.action ? { action: query.action } : {}),
		...(query.from || query.to
			? {
					createdAt: {
						...(query.from ? { gte: query.from } : {}),
						...(query.to ? { lte: query.to } : {}),
					},
				}
			: {}),
	};
	const [data, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			include: { actor: { select: { id: true, name: true, role: true } } },
		}),
		prisma.auditLog.count({ where }),
	]);
	return {
		data,
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};

export const auditLogService = { createAuditLogIntoDB, getAuditLogsFromDB };
