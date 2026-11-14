import type { Prisma } from "../../../generated/prisma/client";
import type { IListQuery } from "../../utils/listQuery";
export interface ICreateProgram {
	code: string;
	name: string;
	departmentId: string;
	totalCreditsRequired: Prisma.Decimal;
	perCreditFee: Prisma.Decimal;
	semesterFee: Prisma.Decimal;
}
export type IUpdateProgram = Partial<ICreateProgram>;
export interface IProgramQuery extends IListQuery {
	departmentId?: string;
}
export interface ICurriculumItem {
	courseId: string;
	term: number;
}
