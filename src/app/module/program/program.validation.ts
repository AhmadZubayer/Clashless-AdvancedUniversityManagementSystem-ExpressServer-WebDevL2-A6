import { z } from "zod";
import { decimalSchema, moneySchema } from "../../utils/decimalSchema";
import { listQuerySchema } from "../../utils/listQuery";

const createSchema = z.object({
	code: z.string().trim().toUpperCase().min(1),
	name: z.string().trim().min(1),
	departmentId: z.uuid(),
	totalCreditsRequired: decimalSchema.refine(
		(value) => value.gt(0) && value.lte("9999.9") && value.decimalPlaces() <= 1,
	),
	perCreditFee: moneySchema,
	semesterFee: moneySchema,
});
const curriculumSchema = z
	.array(
		z.object({ courseId: z.uuid(), term: z.number().int().min(1).max(12) }),
	)
	.refine(
		(rows) => new Set(rows.map((row) => row.courseId)).size === rows.length,
		"Course IDs must be unique",
	);
export const programValidation = {
	createSchema,
	updateSchema: createSchema.partial(),
	curriculumSchema,
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema.extend({ departmentId: z.uuid().optional() }),
};
