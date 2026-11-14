import { z } from "zod";
import { SeatOrder } from "../../../generated/prisma/enums";

const roomSchema = z.object({
	roomNo: z.string().trim().min(1),
	totalSeats: z.number().int().min(1),
	seatsPerColumn: z.number().int().min(1),
});

export const seatPlanValidation = {
	createSchema: z.object({ examSlotId: z.uuid() }),
	overviewQuerySchema: z.object({ semesterId: z.uuid() }),
	idSchema: z.object({ id: z.uuid() }),
	roomParamsSchema: z.object({ id: z.uuid(), roomId: z.uuid() }),
	roomsSchema: z.object({
		rooms: z
			.array(roomSchema)
			.min(1)
			.refine(
				(rooms) =>
					new Set(rooms.map((room) => room.roomNo)).size === rooms.length,
				"roomNo must be unique in the list",
			),
	}),
	generateSchema: z.object({
		orderBy: z.enum(SeatOrder).default("STUDENT_ID"),
	}),
	swapSchema: z.object({ seatAId: z.uuid(), seatBId: z.uuid() }),
	studentSchema: z.object({ studentId: z.uuid() }),
	exportQuerySchema: z.object({
		type: z.enum(["door", "full", "attendance"]),
	}),
	invigilatorsSchema: z.object({ facultyIds: z.array(z.uuid()).min(1) }),
};
