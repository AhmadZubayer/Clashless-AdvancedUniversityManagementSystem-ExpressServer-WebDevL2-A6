import type { IListQuery } from "../../utils/listQuery";
export interface ICreateDepartment {
	code: string;
	name: string;
}
export type IUpdateDepartment = Partial<ICreateDepartment>;
export type IDepartmentQuery = IListQuery;
