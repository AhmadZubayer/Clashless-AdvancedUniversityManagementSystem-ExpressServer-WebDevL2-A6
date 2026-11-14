import { z } from "zod";
export const registrationValidation = {
	idempotencyKeySchema: z.string().trim().min(1).max(200).optional(),
	switchSchema: z
		.object({ fromSectionId: z.uuid(), toSectionId: z.uuid() })
		.refine(
			(value) => value.fromSectionId !== value.toSectionId,
			"Choose a different target section",
		),
	sectionParamsSchema: z.object({ sectionId: z.uuid() }),
};
