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
export interface IRoutineEntryChange {
	roomId?: string;
	dayPatternId?: string;
	timeSlotId?: string;
}
export interface IPublishedRoutineQuery {
	semesterId?: string;
	programId?: string;
	term?: number;
	departmentId?: string;
	facultyId?: string;
	roomId?: string;
}
export interface IRoutineExportQuery {
	semesterId?: string;
	view: "master" | "faculty" | "room";
	facultyId?: string;
	roomId?: string;
}
