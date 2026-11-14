import { z } from "zod";
import { PreferenceKind, Weekday } from "../../../generated/prisma/enums";
const itemSchema = z.object({
	day: z.enum(Weekday),
	timeSlotId: z.uuid(),
	kind: z.enum(PreferenceKind),
});
const replaceSchema = z.object({
	semesterId: z.uuid(),
	items: z
		.array(itemSchema)
		.refine(
			(rows) =>
				new Set(rows.map((row) => `${row.day}:${row.timeSlotId}`)).size ===
				rows.length,
			"Each day and slot may have only one preference",
		),
});
const querySchema = z.object({
	semesterId: z.uuid(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	searchTerm: z.string().trim().optional(),
});
const adminQuerySchema = querySchema.extend({ facultyId: z.uuid().optional() });
export const facultyPreferenceValidation = {
	replaceSchema,
	querySchema,
	adminQuerySchema,
};
