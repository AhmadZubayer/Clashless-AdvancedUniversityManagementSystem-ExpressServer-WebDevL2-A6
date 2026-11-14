import { z } from "zod";
import { RoomType } from "../../../generated/prisma/enums";
import { listQuerySchema } from "../../utils/listQuery";
const createSchema = z.object({
	code: z.string().trim().min(1),
	building: z.string().trim().min(1),
	roomNo: z.string().trim().min(1),
	type: z.enum(RoomType),
	capacity: z.number().int().positive(),
	isActive: z.boolean().default(true),
});
export const roomValidation = {
	createSchema,
	updateSchema: createSchema.partial(),
	idSchema: z.object({ id: z.uuid() }),
	querySchema: listQuerySchema.extend({
		sortBy: z
			.enum(["createdAt", "code", "building", "capacity"])
			.default("createdAt"),
		type: z.enum(RoomType).optional(),
		building: z.string().trim().min(1).optional(),
		minCapacity: z.coerce.number().int().positive().optional(),
		isActive: z
			.enum(["true", "false"])
			.transform((value) => value === "true")
			.optional(),
	}),
};
