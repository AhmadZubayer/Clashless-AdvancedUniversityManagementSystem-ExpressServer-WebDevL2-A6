import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IFacultyPreferences,
	IFacultyPreferenceQuery,
} from "./facultyPreference.interface";

const replaceFacultyPreferencesIntoDB = (
	userId: string,
	payload: IFacultyPreferences,
) =>
	prisma.$transaction(
		async (tx) => {
			const faculty = await tx.faculty.findUnique({
				where: { userId },
				select: { id: true },
			});
			if (!faculty) throw new AppError(404, "Faculty profile not found");
			const semester = await tx.semester.findUnique({
				where: { id: payload.semesterId },
				select: { phase: true },
			});
			if (!semester) throw new AppError(404, "Semester not found");
			if (semester.phase !== "PLANNING")
				throw new AppError(409, "Preferences require PLANNING", {
					code: "PHASE_NOT_ALLOWED",
				});
			if (await tx.routine.count({ where: { semesterId: payload.semesterId } }))
				throw new AppError(
					409,
					"Preferences are locked once any routine version exists",
				);
			const slotIds = [...new Set(payload.items.map((row) => row.timeSlotId))];
			if (
				(await tx.timeSlot.count({
					where: { id: { in: slotIds }, isActive: true },
				})) !== slotIds.length
			)
				throw new AppError(404, "Active time slot not found");
			await tx.facultySlotPreference.deleteMany({
				where: { facultyId: faculty.id, semesterId: payload.semesterId },
			});
			if (payload.items.length)
				await tx.facultySlotPreference.createMany({
					data: payload.items.map((item) => ({
						...item,
						facultyId: faculty.id,
						semesterId: payload.semesterId,
					})),
				});
			return tx.facultySlotPreference.findMany({
				where: { facultyId: faculty.id, semesterId: payload.semesterId },
				include: { timeSlot: true },
				orderBy: [{ day: "asc" }, { timeSlot: { startMinute: "asc" } }],
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

const getFacultyPreferencesFromDB = async (
	query: IFacultyPreferenceQuery,
	userId?: string,
) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: query.semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(404, "Semester not found");
	let facultyId = query.facultyId;
	if (userId) {
		const faculty = await prisma.faculty.findUnique({
			where: { userId },
			select: { id: true },
		});
		if (!faculty) throw new AppError(404, "Faculty profile not found");
		facultyId = faculty.id;
	}
	const where: Prisma.FacultySlotPreferenceWhereInput = {
		semesterId: query.semesterId,
		...(facultyId ? { facultyId } : {}),
		...(query.searchTerm
			? {
					faculty: {
						OR: [
							{ name: { contains: query.searchTerm, mode: "insensitive" } },
							{ email: { contains: query.searchTerm, mode: "insensitive" } },
						],
					},
				}
			: {}),
	};
	const [data, total] = await prisma.$transaction([
		prisma.facultySlotPreference.findMany({
			where,
			include: {
				timeSlot: true,
				faculty: { select: { id: true, name: true, email: true } },
			},
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.facultySlotPreference.count({ where }),
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
export const facultyPreferenceService = {
	replaceFacultyPreferencesIntoDB,
	getFacultyPreferencesFromDB,
};
