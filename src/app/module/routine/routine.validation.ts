import { z } from "zod";
const generateSchema = z.object({
	semesterId: z.uuid(),
	keepPinnedFrom: z.uuid().optional(),
});
export const routineValidation = { generateSchema };
