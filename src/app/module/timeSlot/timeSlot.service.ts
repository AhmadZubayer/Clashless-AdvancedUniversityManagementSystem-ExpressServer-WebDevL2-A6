import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { minutesToTime } from "../../utils/time";
import type {
	ICreateTimeSlot,
	IUpdateTimeSlot,
	ITimeSlotQuery,
} from "./timeSlot.interface";

const ensureNoOverlap = async (
	tx: Prisma.TransactionClient,
	slot: ICreateTimeSlot,
	id?: string,
) => {
	if (slot.startMinute >= slot.endMinute)
		throw new AppError(httpStatus.BAD_REQUEST, "Start must precede end");
	if (
		slot.isActive &&
		(await tx.timeSlot.findFirst({
			where: {
				...(id ? { id: { not: id } } : {}),
				type: slot.type,
				isActive: true,
				startMinute: { lt: slot.endMinute },
				endMinute: { gt: slot.startMinute },
			},
		}))
	)
		throw new AppError(
			httpStatus.CONFLICT,
			"Time slot overlaps an active slot of the same type",
		);
};
const createTimeSlotIntoDB = (payload: ICreateTimeSlot) =>
	prisma.$transaction(
		async (tx) => {
			await ensureNoOverlap(tx, payload);
			return tx.timeSlot.create({
				data: {
					...payload,
					label: `${minutesToTime(payload.startMinute)}-${minutesToTime(payload.endMinute)}`,
				},
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
const getAllTimeSlotsFromDB = async (query: ITimeSlotQuery) => {
	const where: Prisma.TimeSlotWhereInput = {
		...(query.type ? { type: query.type } : {}),
		...(query.searchTerm
			? { label: { contains: query.searchTerm, mode: "insensitive" } }
			: {}),
	};
	const [data, total] = await prisma.$transaction([
		prisma.timeSlot.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { startMinute: query.sortOrder },
		}),
		prisma.timeSlot.count({ where }),
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
const updateTimeSlotIntoDB = (id: string, payload: IUpdateTimeSlot) =>
	prisma.$transaction(
		async (tx) => {
			const slot = await tx.timeSlot.findUnique({ where: { id } });
			if (!slot)
				throw new AppError(httpStatus.NOT_FOUND, "Time slot not found");
			const merged = {
				type: payload.type ?? slot.type,
				startMinute: payload.startMinute ?? slot.startMinute,
				endMinute: payload.endMinute ?? slot.endMinute,
				isActive: payload.isActive ?? slot.isActive,
			};
			const changesTime =
				merged.startMinute !== slot.startMinute ||
				merged.endMinute !== slot.endMinute;
			if (
				changesTime &&
				(await tx.routineEntry.findFirst({
					where: {
						timeSlotId: id,
						routine: {
							status: "PUBLISHED",
							semester: { phase: { not: "CLOSED" } },
						},
					},
				}))
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"Time slot is used by the current published routine",
				);
			await ensureNoOverlap(tx, merged, id);
			return tx.timeSlot.update({
				where: { id },
				data: {
					...merged,
					label: `${minutesToTime(merged.startMinute)}-${minutesToTime(merged.endMinute)}`,
				},
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
export const timeSlotService = {
	createTimeSlotIntoDB,
	getAllTimeSlotsFromDB,
	updateTimeSlotIntoDB,
};
