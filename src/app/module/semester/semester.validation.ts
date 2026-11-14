import { z } from "zod";
import { decimalSchema } from "../../utils/decimalSchema";
import { listQuerySchema } from "../../utils/listQuery";
import { offsetDateSchema } from "../../utils/offsetDateSchema";

const semesterSchema = z.object({
	code: z.string().trim().min(1),
	name: z.string().trim().min(1),
	classStartDate: offsetDateSchema.nullable().optional(),
	examStartDate: offsetDateSchema.nullable().optional(),
	examEndDate: offsetDateSchema.nullable().optional(),
	gradeDeadline: offsetDateSchema.nullable().optional(),
	maxCredits: decimalSchema.refine(
		(value) => value.gt(0) && value.lte("999.9") && value.decimalPlaces() <= 1,
	),
	minPaymentPercent: z.number().int().min(0).max(100),
	paymentDeadlineDays: z.number().int().min(0),
});
export const semesterValidation = {
	createSchema: semesterSchema.extend({
		maxCredits: semesterSchema.shape.maxCredits.prefault(15),
		minPaymentPercent: semesterSchema.shape.minPaymentPercent.default(40),
		paymentDeadlineDays: semesterSchema.shape.paymentDeadlineDays.default(12),
	}),
	updateSchema: semesterSchema.partial(),
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema,
};
