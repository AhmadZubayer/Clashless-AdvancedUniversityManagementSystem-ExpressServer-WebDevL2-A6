import { z } from "zod";
export const registrationValidation = {
	catalogQuerySchema: z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		sortBy: z.enum(["createdAt", "code", "title"]).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
		searchTerm: z.string().trim().optional(),
	}),
	idempotencyKeySchema: z.string().trim().min(1).max(200).optional(),
	switchSchema: z
		.object({ fromSectionId: z.uuid(), toSectionId: z.uuid() })
		.refine(
			(value) => value.fromSectionId !== value.toSectionId,
			"Choose a different target section",
		),
	sectionParamsSchema: z.object({ sectionId: z.uuid() }),
};
