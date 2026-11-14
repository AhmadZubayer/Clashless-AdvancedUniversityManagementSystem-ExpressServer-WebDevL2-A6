import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateRoom, IUpdateRoom, IRoomQuery } from "./room.interface";
const createRoomIntoDB = (payload: ICreateRoom) =>
	prisma.$transaction(async (tx) => {
		if (await tx.room.findUnique({ where: { code: payload.code } }))
			throw new AppError(httpStatus.CONFLICT, "Room code already exists");
		return tx.room.create({ data: payload });
	});
const getAllRoomsFromDB = async (query: IRoomQuery) => {
	const where: Prisma.RoomWhereInput = {
		...(query.type ? { type: query.type } : {}),
		...(query.building ? { building: query.building } : {}),
		...(query.minCapacity ? { capacity: { gte: query.minCapacity } } : {}),
		...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
		...(query.searchTerm
			? {
					OR: [
						{ code: { contains: query.searchTerm, mode: "insensitive" } },
						{ building: { contains: query.searchTerm, mode: "insensitive" } },
						{ roomNo: { contains: query.searchTerm, mode: "insensitive" } },
					],
				}
			: {}),
	};
	const [data, total] = await prisma.$transaction([
		prisma.room.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.room.count({ where }),
	]);
	return {
		data,
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};
const updateRoomIntoDB = (id: string, payload: IUpdateRoom) =>
	prisma.$transaction(async (tx) => {
		const room = await tx.room.findUnique({ where: { id } });
		if (!room) throw new AppError(httpStatus.NOT_FOUND, "Room not found");
		if (
			payload.isActive === false &&
			room.isActive &&
			(await tx.routineEntry.findFirst({
				where: {
					roomId: id,
					routine: {
						status: "PUBLISHED",
						semester: { phase: { not: "CLOSED" } },
					},
				},
			}))
		)
			throw new AppError(
				httpStatus.CONFLICT,
				"Room is used by the current published routine",
			);
		if (
			payload.code &&
			(await tx.room.findFirst({
				where: { code: payload.code, id: { not: id } },
			}))
		)
			throw new AppError(httpStatus.CONFLICT, "Room code already exists");
		return tx.room.update({ where: { id }, data: payload });
	});
export const roomService = {
	createRoomIntoDB,
	getAllRoomsFromDB,
	updateRoomIntoDB,
};
