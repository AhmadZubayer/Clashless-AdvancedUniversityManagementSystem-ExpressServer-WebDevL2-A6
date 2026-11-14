import { z } from "zod";
import { listQuerySchema } from "../../utils/listQuery";

const createSchema = z.object({
	code: z.string().trim().toUpperCase().min(1),
	name: z.string().trim().min(1),
});
export const departmentValidation = {
	createSchema,
	updateSchema: createSchema.partial(),
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema,
};
