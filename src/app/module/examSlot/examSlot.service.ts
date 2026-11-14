import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { overlaps } from "../../utils/time";
import type { ICreateExamSlots } from "./examSlot.interface";

const dhakaDate = (date: Date) =>
	new Date(date.getTime() + 6 * 3600000).toISOString().slice(0, 10);
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

const createExamSlotsIntoDB = async (payload: ICreateExamSlots) =>
	prisma.$transaction(
		async (tx) => {
			const semester = await tx.semester.findUnique({
				where: { id: payload.semesterId },
			});
			if (!semester) throw new AppError(404, "Semester not found");
			if (!semester.examStartDate || !semester.examEndDate)
				throw new AppError(409, "Set the semester's exam period first");
			const from = dhakaDate(semester.examStartDate);
			const to = dhakaDate(semester.examEndDate);
			const outside = payload.slots.filter(
				(slot) => slot.date < from || slot.date > to,
			);
			if (outside.length)
				throw new AppError(
					400,
					`Exam slots must fall between ${from} and ${to}`,
					outside.map((slot) => ({ field: "date", message: slot.date })),
				);
			const existing = await tx.examSlot.findMany({
				where: { semesterId: payload.semesterId },
			});
			const all = [
				...existing.map((slot) => ({
					date: dateOnly(slot.date),
					startMinute: slot.startMinute,
					endMinute: slot.endMinute,
				})),
			];
			for (const slot of payload.slots) {
				const clash = all.find(
					(other) => other.date === slot.date && overlaps(other, slot),
				);
				if (clash)
					throw new AppError(409, "Exam slots on one date cannot overlap", {
						slot,
						clashesWith: clash,
					});
				all.push(slot);
			}
			return tx.examSlot.createManyAndReturn({
				data: payload.slots.map((slot) => ({
					semesterId: payload.semesterId,
					date: new Date(`${slot.date}T00:00:00.000Z`),
					startMinute: slot.startMinute,
					endMinute: slot.endMinute,
				})),
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

const getExamSlotsFromDB = async (semesterId: string) => {
	const slots = await prisma.examSlot.findMany({
		where: { semesterId },
		orderBy: [{ date: "asc" }, { startMinute: "asc" }],
	});
	const published = await prisma.examRoutine.findFirst({
		where: { semesterId, status: "PUBLISHED" },
		select: { id: true },
	});
	if (!published) return slots.map((slot) => ({ ...slot, courses: null }));
	const entries = await prisma.examRoutineEntry.findMany({
		where: { examRoutineId: published.id },
		select: {
			examSlotId: true,
			offeringId: true,
			offering: {
				select: {
					course: { select: { code: true, title: true } },
					_count: {
						select: { enrollments: { where: { status: "ENROLLED" } } },
					},
				},
			},
		},
	});
	return slots.map((slot) => {
		const courses = entries
			.filter((entry) => entry.examSlotId === slot.id)
			.map((entry) => ({
				offeringId: entry.offeringId,
				code: entry.offering.course.code,
				title: entry.offering.course.title,
				studentCount: entry.offering._count.enrollments,
			}));
		return {
			...slot,
			courses,
			studentCount: courses.reduce((sum, row) => sum + row.studentCount, 0),
		};
	});
};

const deleteExamSlotIntoDB = (id: string) =>
	prisma.$transaction(async (tx) => {
		const slot = await tx.examSlot.findUnique({
			where: { id },
			include: { seatPlan: { select: { id: true } } },
		});
		if (!slot) throw new AppError(404, "Exam slot not found");
		const published = await tx.examRoutineEntry.count({
			where: { examSlotId: id, examRoutine: { status: "PUBLISHED" } },
		});
		if (published || slot.seatPlan)
			throw new AppError(
				409,
				"This slot is used by the published exam routine or a seat plan",
			);
		// drafts and archived versions lose their entries for this slot
		await tx.examRoutineEntry.deleteMany({ where: { examSlotId: id } });
		await tx.examSlot.delete({ where: { id } });
		return { id };
	});

export const examSlotService = {
	createExamSlotsIntoDB,
	getExamSlotsFromDB,
	deleteExamSlotIntoDB,
};
