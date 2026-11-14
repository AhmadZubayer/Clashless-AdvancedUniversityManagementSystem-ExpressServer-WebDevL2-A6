import { z } from "zod";
import { LetterGrade } from "../../../generated/prisma/enums";

export const gradeValidation = {
	sectionParamsSchema: z.object({ sectionId: z.uuid() }),
	submitSchema: z.object({
		grades: z
			.array(z.object({ enrollmentId: z.uuid(), grade: z.enum(LetterGrade) }))
			.min(1)
			.refine(
				(rows) =>
					new Set(rows.map((row) => row.enrollmentId)).size === rows.length,
				"Each enrollment may appear only once",
			),
	}),
	statusQuerySchema: z.object({ semesterId: z.uuid() }),
	publishSchema: z.object({ semesterId: z.uuid() }),
};
