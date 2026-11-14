import type { SlotType } from "../../../generated/prisma/enums";
import type { IListQuery } from "../../utils/listQuery";
export interface ICreateTimeSlot {
	type: SlotType;
	startMinute: number;
	endMinute: number;
	isActive: boolean;
}
export type IUpdateTimeSlot = Partial<ICreateTimeSlot>;
export interface ITimeSlotQuery extends Omit<IListQuery, "sortBy"> {
	sortBy: "startMinute";
	type?: SlotType;
}
