import { z } from "zod";
import { LetterGrade } from "../../../generated/prisma/enums";
const rowSchema = z.object({
	universityId: z.string().trim().min(1),
	courseCode: z.string().trim().toUpperCase().min(1),
	grade: z.enum(LetterGrade),
});
export const resultValidation = { rowSchema, importSchema: z.object({}) };
