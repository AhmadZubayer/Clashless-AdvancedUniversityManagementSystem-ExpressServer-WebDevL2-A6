import type { Prisma } from "../../../generated/prisma/client";
import type { IListQuery } from "../../utils/listQuery";

export interface ICreateSemester {
	code: string;
	name: string;
	classStartDate?: Date | null;
	examStartDate?: Date | null;
	examEndDate?: Date | null;
	gradeDeadline?: Date | null;
	maxCredits: Prisma.Decimal;
	minPaymentPercent: number;
	paymentDeadlineDays: number;
}
export type IUpdateSemester = Partial<ICreateSemester>;
export type ISemesterQuery = IListQuery;
