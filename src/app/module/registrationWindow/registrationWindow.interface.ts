import type { IListQuery } from "../../utils/listQuery";
export interface ICreateRegistrationWindow {
	semesterId: string;
	batchId: string;
	startsAt: Date;
	endsAt: Date;
}
export interface IUpdateRegistrationWindow
	extends Partial<ICreateRegistrationWindow> {
	reason?: string;
}
export interface IRegistrationWindowQuery extends Omit<IListQuery, "sortBy"> {
	semesterId: string;
	sortBy: "createdAt" | "startsAt" | "endsAt";
}
