import { z } from "zod";

export const notificationValidation = {
	querySchema: z.object({
		unread: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
	}),
	idSchema: z.object({ id: z.uuid() }),
};
