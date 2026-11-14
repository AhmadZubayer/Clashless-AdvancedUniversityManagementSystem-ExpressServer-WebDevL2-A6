import { z } from "zod";
import { listQuerySchema } from "../../utils/listQuery";
import { offsetDateSchema } from "../../utils/offsetDateSchema";
const windowSchema = z.object({
	semesterId: z.uuid(),
	batchId: z.uuid(),
	startsAt: offsetDateSchema,
	endsAt: offsetDateSchema,
});
export const registrationWindowValidation = {
	createSchema: windowSchema.refine(
		(window) => window.endsAt > window.startsAt,
		"End must be after start",
	),
	updateSchema: windowSchema
		.partial()
		.extend({ reason: z.string().trim().min(1).optional() }),
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema.extend({
		semesterId: z.uuid(),
		sortBy: z.enum(["createdAt", "startsAt", "endsAt"]).default("createdAt"),
	}),
};
