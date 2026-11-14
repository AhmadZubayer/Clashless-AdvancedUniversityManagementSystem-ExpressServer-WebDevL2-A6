import type { Prisma } from "../../../generated/prisma/client";
import type { CourseType, LetterGrade } from "../../../generated/prisma/enums";
import type { IListQuery } from "../../utils/listQuery";
export interface ICreateCourse {
	code: string;
	title: string;
	credits: Prisma.Decimal;
	type: CourseType;
	departmentId: string;
}
export type IUpdateCourse = Partial<ICreateCourse>;
export interface ICourseQuery extends Omit<IListQuery, "sortBy"> {
	sortBy: "createdAt" | "code" | "title";
	departmentId?: string;
	type?: CourseType;
}
export interface IPrerequisiteItem {
	prerequisiteId: string;
	minGrade: LetterGrade;
}
