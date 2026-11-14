import type { IListQuery } from "../../utils/listQuery";
export interface ICreateBatch {
	code: string;
}
export type IBatchQuery = Omit<IListQuery, "sortBy"> & {
	sortBy: "createdAt" | "code";
};
