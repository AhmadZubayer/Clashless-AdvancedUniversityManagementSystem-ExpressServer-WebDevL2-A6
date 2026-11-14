import { z } from "zod";

const scheduleSchema = z.object({
	roomId: z.uuid(),
	dayPatternId: z.uuid(),
	timeSlotId: z.uuid(),
});
const createSchema = scheduleSchema.partial().extend({
	offeringId: z.uuid(),
	capacity: z.number().int().positive().default(40),
	facultyId: z.uuid().optional(),
});
const updateSchema = z
	.object({
		capacity: z.number().int().positive().optional(),
		status: z.enum(["OPEN", "CLOSED"]).optional(),
		facultyId: z.uuid().nullable().optional(),
	})
	.refine(
		(value) => Object.keys(value).length > 0,
		"At least one change is required",
	);
const rescheduleSchema = scheduleSchema.extend({
	reason: z.string().trim().min(1).max(1000),
});
const cancelSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
const idSchema = z.object({ id: z.uuid() });
export const sectionValidation = {
	createSchema,
	updateSchema,
	rescheduleSchema,
	cancelSchema,
	idSchema,
};
