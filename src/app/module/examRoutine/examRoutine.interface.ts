export interface IGenerateExamRoutine {
	semesterId: string;
	maxStudentsPerSlot: number;
}

export interface IExamRoutineListQuery {
	semesterId: string;
	page: number;
	limit: number;
	sortBy: "createdAt" | "version";
	sortOrder: "asc" | "desc";
}
