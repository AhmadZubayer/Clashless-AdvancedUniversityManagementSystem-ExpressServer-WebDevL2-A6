export interface IGenerateRoutine {
	semesterId: string;
	keepPinnedFrom?: string;
}
export interface IRoutineListQuery {
	semesterId: string;
	page: number;
	limit: number;
	sortBy: "createdAt" | "version";
	sortOrder: "asc" | "desc";
	searchTerm?: string;
}
export interface IRoutineViewQuery {
	view: "section" | "faculty" | "room" | "program";
	facultyId?: string;
	roomId?: string;
	programId?: string;
	term?: number;
}
