import { z } from "zod";
import { listQuerySchema } from "../../utils/listQuery";
export const batchValidation = {
	createSchema: z.object({
		code: z
			.string()
			.trim()
			.regex(
				/^\d{2}-[1-3]$/,
				"Batch code must look like 23-3 with term 1, 2 or 3",
			),
	}),
	querySchema: listQuerySchema.extend({
		sortBy: z.enum(["createdAt", "code"]).default("createdAt"),
	}),
};
