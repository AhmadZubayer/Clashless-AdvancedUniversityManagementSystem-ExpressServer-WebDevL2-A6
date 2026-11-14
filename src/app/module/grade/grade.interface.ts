import type { LetterGrade } from "../../../generated/prisma/enums";

export interface IGradeSubmission {
	grades: { enrollmentId: string; grade: LetterGrade }[];
}
