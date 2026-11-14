import type { RoomType } from "../../../generated/prisma/enums";
import type { IListQuery } from "../../utils/listQuery";
export interface ICreateRoom {
	code: string;
	building: string;
	roomNo: string;
	type: RoomType;
	capacity: number;
	isActive: boolean;
}
export type IUpdateRoom = Partial<ICreateRoom>;
export interface IRoomQuery extends Omit<IListQuery, "sortBy"> {
	sortBy: "createdAt" | "code" | "building" | "capacity";
	type?: RoomType;
	building?: string;
	minCapacity?: number;
	isActive?: boolean;
}
