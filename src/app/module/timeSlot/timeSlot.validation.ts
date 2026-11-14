import { z } from "zod";
import { SlotType } from "../../../generated/prisma/enums";
import { listQuerySchema } from "../../utils/listQuery";
const slotSchema = z.object({
	type: z.enum(SlotType),
	startMinute: z.number().int().min(0).max(1439),
	endMinute: z.number().int().min(1).max(1439),
	isActive: z.boolean().default(true),
});
export const timeSlotValidation = {
	createSchema: slotSchema.refine(
		(slot) => slot.startMinute < slot.endMinute,
		"Start must precede end",
	),
	updateSchema: slotSchema.partial(),
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema.extend({
		sortBy: z.literal("startMinute").default("startMinute"),
		sortOrder: z.enum(["asc", "desc"]).default("asc"),
		type: z.enum(SlotType).optional(),
	}),
};
