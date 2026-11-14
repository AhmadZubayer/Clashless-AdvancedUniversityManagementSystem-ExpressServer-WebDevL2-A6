import { z } from "zod";
import { CourseType, LetterGrade } from "../../../generated/prisma/enums";
import { decimalSchema } from "../../utils/decimalSchema";
import { listQuerySchema } from "../../utils/listQuery";
const createSchema = z.object({
	code: z.string().trim().toUpperCase().min(1),
	title: z.string().trim().min(1),
	credits: decimalSchema.refine(
		(value) => value.gte("0.5") && value.lte(6) && value.mod("0.5").isZero(),
		"Credits must be 0.5 through 6 in steps of 0.5",
	),
	type: z.enum(CourseType),
	departmentId: z.uuid(),
});
const prerequisitesSchema = z
	.array(
		z.object({
			prerequisiteId: z.uuid(),
			minGrade: z.enum(LetterGrade).default("D"),
		}),
	)
	.refine(
		(items) =>
			new Set(items.map((item) => item.prerequisiteId)).size === items.length,
		"Prerequisite IDs must be unique",
	);
export const courseValidation = {
	createSchema,
	updateSchema: createSchema.partial(),
	prerequisitesSchema,
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema.extend({
		sortBy: z.enum(["createdAt", "code", "title"]).default("createdAt"),
		departmentId: z.uuid().optional(),
		type: z.enum(CourseType).optional(),
	}),
};
