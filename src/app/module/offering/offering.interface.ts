import type { IListQuery } from "../../utils/listQuery";
export interface ICreateOffering {
	semesterId: string;
	courseId: string;
	sectionCount: number;
	capacity: number;
}
export interface IOfferingQuery extends Omit<IListQuery, "sortBy"> {
	semesterId: string;
	departmentId?: string;
	sortBy: "createdAt" | "updatedAt";
}
