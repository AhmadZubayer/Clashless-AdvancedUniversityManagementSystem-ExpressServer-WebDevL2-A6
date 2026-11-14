import { z } from "zod";
import { SlotType, Weekday } from "../../../generated/prisma/enums";
import { listQuerySchema } from "../../utils/listQuery";
const createSchema = z
	.object({
		code: z.string().trim().toUpperCase().min(1),
		type: z.enum(SlotType),
		days: z.array(z.enum(Weekday)),
	})
	.refine(
		(pattern) =>
			pattern.days.length === (pattern.type === "THEORY" ? 2 : 1) &&
			new Set(pattern.days).size === pattern.days.length,
		"THEORY requires two distinct days; LAB requires one day",
	);
export const dayPatternValidation = {
	createSchema,
	querySchema: listQuerySchema.extend({
		sortBy: z.enum(["createdAt", "code"]).default("createdAt"),
		type: z.enum(SlotType).optional(),
	}),
};
