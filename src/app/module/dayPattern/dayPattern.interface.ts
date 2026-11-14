import type { SlotType, Weekday } from "../../../generated/prisma/enums";
import type { IListQuery } from "../../utils/listQuery";
export interface ICreateDayPattern {
	code: string;
	type: SlotType;
	days: Weekday[];
}
export interface IDayPatternQuery extends Omit<IListQuery, "sortBy"> {
	sortBy: "createdAt" | "code";
	type?: SlotType;
}
