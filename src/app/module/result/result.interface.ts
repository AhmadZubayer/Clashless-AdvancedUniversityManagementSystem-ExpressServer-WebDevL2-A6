import type { LetterGrade } from "../../../generated/prisma/enums";
export interface IImportedResult {
	universityId: string;
	courseCode: string;
	grade: LetterGrade;
}
export interface IResultImportReport {
	created: number;
	failed: { row: number; reason: string }[];
}
