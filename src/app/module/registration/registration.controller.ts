import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { registrationService } from "./registration.service";
import { registrationValidation } from "./registration.validation";
const selectSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const parsed = registrationValidation.idempotencyKeySchema.safeParse(
		req.get("Idempotency-Key"),
	);
	if (!parsed.success)
		throw new AppError(400, "Idempotency-Key must contain 1 to 200 characters");
	const result = await registrationService.selectSectionWithGuardsIntoDB(
		req.user.id,
		res.locals.validatedParams.sectionId,
		parsed.data,
	);
	sendResponse(res, { success: true, message: "Section selected", ...result });
});
const unselectSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await registrationService.unselectSectionIntoDB(
		req.user.id,
		res.locals.validatedParams.sectionId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section unselected",
		data,
	});
});
const switchSection = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await registrationService.switchSectionIntoDB(
		req.user.id,
		req.body.fromSectionId,
		req.body.toSectionId,
	);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Section switched",
		data,
	});
});
export const registrationController = {
	selectSection,
	unselectSection,
	switchSection,
};
