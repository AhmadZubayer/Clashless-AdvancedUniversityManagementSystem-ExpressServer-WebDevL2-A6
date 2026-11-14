import { z } from "zod";
const generateSchema = z.object({
	semesterId: z.uuid(),
	keepPinnedFrom: z.uuid().optional(),
});
const idSchema = z.object({ id: z.uuid() });
const listQuerySchema = z.object({
	semesterId: z.uuid(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	sortBy: z.enum(["createdAt", "version"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	searchTerm: z.string().trim().optional(),
});
const viewQuerySchema = z
	.object({
		view: z.enum(["section", "faculty", "room", "program"]).default("section"),
		facultyId: z.uuid().optional(),
		roomId: z.uuid().optional(),
		programId: z.uuid().optional(),
		term: z.coerce.number().int().min(1).optional(),
	})
	.refine(
		(query) => query.view !== "faculty" || !!query.facultyId,
		"Faculty view requires facultyId",
	)
	.refine(
		(query) => query.view !== "room" || !!query.roomId,
		"Room view requires roomId",
	)
	.refine(
		(query) => query.view !== "program" || (!!query.programId && !!query.term),
		"Program view requires programId and term",
	);
export const routineValidation = {
	entryParamsSchema: z.object({ id: z.uuid(), entryId: z.uuid() }),
	moveSchema: z
		.object({
			roomId: z.uuid().optional(),
			dayPatternId: z.uuid().optional(),
			timeSlotId: z.uuid().optional(),
		})
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one schedule field is required",
		),
	swapSchema: z
		.object({ entryAId: z.uuid(), entryBId: z.uuid() })
		.refine(
			(value) => value.entryAId !== value.entryBId,
			"Choose two different entries",
		),
	generateSchema,
	idSchema,
	listQuerySchema,
	viewQuerySchema,
};
