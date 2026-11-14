import { z } from "zod";

export const examRoutineValidation = {
	generateSchema: z.object({
		semesterId: z.uuid(),
		maxStudentsPerSlot: z.number().int().min(1),
	}),
	listQuerySchema: z.object({
		semesterId: z.uuid(),
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		sortBy: z.enum(["createdAt", "version"]).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	}),
	idSchema: z.object({ id: z.uuid() }),
	entryParamsSchema: z.object({ id: z.uuid(), entryId: z.uuid() }),
	moveSchema: z.object({ examSlotId: z.uuid() }),
};
