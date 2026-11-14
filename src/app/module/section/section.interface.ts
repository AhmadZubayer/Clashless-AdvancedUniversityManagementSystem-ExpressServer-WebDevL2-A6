export interface ISectionSchedule {
	roomId: string;
	dayPatternId: string;
	timeSlotId: string;
}
export interface ICreateSection extends Partial<ISectionSchedule> {
	offeringId: string;
	capacity: number;
	facultyId?: string;
}
export interface IUpdateSection {
	capacity?: number;
	status?: "OPEN" | "CLOSED";
	facultyId?: string | null;
}
export interface IFacultyAssignments {
	semesterId: string;
	assignments: { sectionId: string; facultyId: string }[];
}
