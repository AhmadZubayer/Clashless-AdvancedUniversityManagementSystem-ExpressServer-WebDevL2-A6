import type { Request, Response } from "express";
import { logger } from "../../lib/logger";
import { subscribeSeatEvents, type ISeatEvent } from "../../lib/seatEvents";
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
const getMyRegistration = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) throw new AppError(401, "Please log in");
	const data = await registrationService.getMyRegistrationFromDB(req.user.id);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "My registration retrieved",
		data,
	});
});
const getRegistrationOfferings = catchAsync(
	async (req: Request, res: Response) => {
		if (!req.user) throw new AppError(401, "Please log in");
		const result = await registrationService.getRegistrationOfferingsFromDB(
			req.user.id,
			res.locals.validatedQuery,
		);
		sendResponse(res, {
			success: true,
			statusCode: 200,
			message: "Registration offerings retrieved",
			...result,
		});
	},
);
const streamSeats = catchAsync(async (_req: Request, res: Response) => {
	const semester = await registrationService.getSeatStreamSemesterFromDB();
	if (res.destroyed) return;
	let closed = false;
	let ready = false;
	let stop: (() => Promise<void>) | undefined;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	const pending: ISeatEvent[] = [];
	const cleanup = () => {
		if (heartbeat) clearInterval(heartbeat);
		const unsubscribe = stop;
		stop = undefined;
		if (unsubscribe)
			void unsubscribe().catch(() =>
				logger.error("Seat stream cleanup failed"),
			);
	};
	res.once("close", () => {
		closed = true;
		cleanup();
	});
	stop = await subscribeSeatEvents(semester.id, (event) => {
		if (closed) return;
		if (!ready) pending.push(event);
		else res.write(`data: ${JSON.stringify(event)}\n\n`);
	});
	if (closed) {
		cleanup();
		return;
	}
	res.status(200).set({
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
	});
	res.flushHeaders();
	ready = true;
	res.write(": connected\n\n");
	for (const event of pending) res.write(`data: ${JSON.stringify(event)}\n\n`);
	heartbeat = setInterval(() => {
		if (!closed) res.write(": heartbeat\n\n");
	}, 25000);
});
export const registrationController = {
	streamSeats,
	getMyRegistration,
	getRegistrationOfferings,
	selectSection,
	unselectSection,
	switchSection,
};
