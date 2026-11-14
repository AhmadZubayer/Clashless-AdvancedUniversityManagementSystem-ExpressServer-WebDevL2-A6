import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { auditLogService } from "./auditLog.service";

const getAuditLogs = catchAsync(async (_req: Request, res: Response) => {
	const result = await auditLogService.getAuditLogsFromDB(
		res.locals.validatedQuery,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Audit log retrieved",
		...result,
	});
});

export const auditLogController = { getAuditLogs };
