import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const slotSchema = z
	.object({
		date: dateSchema,
		startMinute: z.number().int().min(0).max(1439),
		endMinute: z.number().int().min(1).max(1440),
	})
	.refine((slot) => slot.startMinute < slot.endMinute, {
		message: "startMinute must be before endMinute",
	});

export const examSlotValidation = {
	createSchema: z.object({
		semesterId: z.uuid(),
		slots: z.array(slotSchema).min(1).max(200),
	}),
	querySchema: z.object({ semesterId: z.uuid() }),
	idSchema: z.object({ id: z.uuid() }),
};
