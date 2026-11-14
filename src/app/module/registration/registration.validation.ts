import { z } from "zod";
export const registrationValidation = {
	switchSchema: z
		.object({ fromSectionId: z.uuid(), toSectionId: z.uuid() })
		.refine(
			(value) => value.fromSectionId !== value.toSectionId,
			"Choose a different target section",
		),
	sectionParamsSchema: z.object({ sectionId: z.uuid() }),
};
