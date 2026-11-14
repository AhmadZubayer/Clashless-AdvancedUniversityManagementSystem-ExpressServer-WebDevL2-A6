import type { PreferenceKind, Weekday } from "../../../generated/prisma/enums";
export interface IFacultyPreferences {
	semesterId: string;
	items: { day: Weekday; timeSlotId: string; kind: PreferenceKind }[];
}
export interface IFacultyPreferenceQuery {
	semesterId: string;
	facultyId?: string;
	page: number;
	limit: number;
	sortBy: "createdAt" | "updatedAt";
	sortOrder: "asc" | "desc";
	searchTerm?: string;
}
