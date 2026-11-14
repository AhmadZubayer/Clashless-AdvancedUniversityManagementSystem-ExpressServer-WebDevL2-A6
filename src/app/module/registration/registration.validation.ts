import { z } from "zod";
export const registrationValidation = {
	sectionParamsSchema: z.object({ sectionId: z.uuid() }),
};
