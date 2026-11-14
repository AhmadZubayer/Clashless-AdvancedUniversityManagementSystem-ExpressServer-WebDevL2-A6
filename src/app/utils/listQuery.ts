import { z } from "zod";

export const listQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	sortBy: z.enum(["createdAt", "name", "code"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	searchTerm: z.string().trim().min(1).optional(),
});

export type IListQuery = z.infer<typeof listQuerySchema>;
