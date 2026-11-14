import { z } from "zod";
import { offsetDateSchema } from "../../utils/offsetDateSchema";

export const auditLogValidation = {
	querySchema: z.object({
		entity: z.string().trim().min(1).optional(),
		entityId: z.string().trim().min(1).optional(),
		actorId: z.uuid().optional(),
		action: z.string().trim().min(1).optional(),
		from: offsetDateSchema.optional(),
		to: offsetDateSchema.optional(),
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
	}),
};
