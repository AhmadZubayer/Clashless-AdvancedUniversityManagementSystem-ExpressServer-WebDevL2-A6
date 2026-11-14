import { z } from "zod";
import { listQuerySchema } from "../../utils/listQuery";
export const offeringValidation = {
	createSchema: z.object({
		semesterId: z.uuid(),
		courseId: z.uuid(),
		sectionCount: z.number().int().positive(),
		capacity: z.number().int().positive().default(40),
	}),
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema.extend({
		semesterId: z.uuid(),
		departmentId: z.uuid().optional(),
		sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
	}),
};
