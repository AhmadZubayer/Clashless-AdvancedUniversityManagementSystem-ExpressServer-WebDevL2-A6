import { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { generateRoutine, scoreRoutine } from "../../engine/routineGenerator";
import type { IRoutineGenerationInput } from "../../engine/routineGenerator";
import { validateRoutine } from "../../engine/routineValidator";
import { enqueueJob } from "../../lib/queue";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IGenerateRoutine,
	IRoutineListQuery,
	IRoutineViewQuery,
	IRoutineEntryChange,
} from "./routine.interface";
import "../../jobs/routine";

const transactionOptions = {
	isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
	timeout: 15000,
};

async function loadRoutineInputFromDB(
	tx: Prisma.TransactionClient,
	semesterId: string,
	keepPinnedFrom?: string,
): Promise<IRoutineGenerationInput> {
	const [rows, rooms, timeSlots, dayPatterns, preferences, curriculum] =
		await Promise.all([
			tx.section.findMany({
				where: { offering: { semesterId }, status: { not: "CANCELLED" } },
				include: { offering: { include: { course: true } } },
				orderBy: { id: "asc" },
			}),
			tx.room.findMany(),
			tx.timeSlot.findMany(),
			tx.dayPattern.findMany(),
			tx.facultySlotPreference.findMany({ where: { semesterId } }),
			tx.curriculumCourse.findMany(),
		]);
	let pinnedEntries: IRoutineGenerationInput["pinnedEntries"] = [];
	if (keepPinnedFrom) {
		const source = await tx.routine.findFirst({
			where: { id: keepPinnedFrom, semesterId },
			include: {
				entries: {
					where: { isPinned: true, section: { status: { not: "CANCELLED" } } },
				},
			},
		});
		if (!source)
			throw new AppError(
				404,
				"Pinned source routine not found in this semester",
			);
		pinnedEntries = source.entries;
	}
	return {
		semesterId,
		sections: rows.map((row) => ({
			id: row.id,
			courseId: row.offering.courseId,
			type: row.offering.course.type,
			capacity: row.capacity,
			facultyId: row.facultyId,
			label: `${row.offering.course.code} section ${row.sectionNo}`,
		})),
		rooms,
		timeSlots,
		dayPatterns,
		preferences,
		curriculum,
		pinnedEntries,
	};
}

const requestRoutineGenerationIntoDB = async (
	actorId: string,
	payload: IGenerateRoutine,
) => {
	const job = await prisma.$transaction(async (tx) => {
		const semester = await tx.semester.findUnique({
			where: { id: payload.semesterId },
			select: { phase: true },
		});
		if (!semester) throw new AppError(404, "Semester not found");
		if (semester.phase !== "PLANNING")
			throw new AppError(409, "Routine generation requires PLANNING", {
				code: "PHASE_NOT_ALLOWED",
			});
		const missing = await tx.section.findMany({
			where: {
				offering: { semesterId: payload.semesterId },
				status: { not: "CANCELLED" },
				facultyId: null,
			},
			select: {
				id: true,
				sectionNo: true,
				offering: { select: { course: { select: { code: true } } } },
			},
		});
		if (missing.length)
			throw new AppError(
				409,
				"Every section must have a teacher before generation",
				{
					sections: missing.map((row) => ({
						sectionId: row.id,
						sectionNo: row.sectionNo,
						courseCode: row.offering.course.code,
					})),
				},
			);
		if (payload.keepPinnedFrom) {
			const input = await loadRoutineInputFromDB(
				tx,
				payload.semesterId,
				payload.keepPinnedFrom,
			);
			const validation = validateRoutine({
				...input,
				entries: input.pinnedEntries ?? [],
			});
			if (!validation.ok)
				throw new AppError(409, "Pinned entries violate hard rules", {
					code: "HARD_RULE_VIOLATION",
					violations: validation.violations,
				});
		}
		return tx.generationJob.create({
			data: {
				type: "CLASS_ROUTINE",
				semesterId: payload.semesterId,
				createdById: actorId,
				input: payload.keepPinnedFrom
					? { keepPinnedFrom: payload.keepPinnedFrom }
					: {},
			},
		});
	}, transactionOptions);
	try {
		await enqueueJob("routine", { jobId: job.id }, job.id);
	} catch {
		await prisma.generationJob.updateMany({
			where: { id: job.id, status: "QUEUED" },
			data: {
				status: "FAILED",
				error: "Could not queue routine generation",
				finishedAt: new Date(),
			},
		});
		throw new AppError(500, "Could not queue routine generation");
	}
	return { jobId: job.id };
};

const processRoutineJobIntoDB = async (jobId: string) => {
	const claimed = await prisma.generationJob.updateMany({
		where: { id: jobId, type: "CLASS_ROUTINE", status: "QUEUED" },
		data: { status: "RUNNING", startedAt: new Date(), progress: 0 },
	});
	if (!claimed.count) return;
	let progressWrites = Promise.resolve();
	try {
		const job = await prisma.generationJob.findUniqueOrThrow({
			where: { id: jobId },
		});
		const options = job.input as { keepPinnedFrom?: string } | null;
		const input = await prisma.$transaction(
			(tx) =>
				loadRoutineInputFromDB(tx, job.semesterId, options?.keepPinnedFrom),
			transactionOptions,
		);
		if (input.sections.some((row) => !row.facultyId))
			throw new AppError(409, "A section no longer has a teacher");
		const result = generateRoutine(input, (progress) => {
			progressWrites = progressWrites.then(async () => {
				await prisma.generationJob.updateMany({
					where: { id: jobId, status: "RUNNING", progress: { lt: progress } },
					data: { progress },
				});
			});
		});
		await progressWrites;
		return await prisma.$transaction(async (tx) => {
			const semester = await tx.semester.findUniqueOrThrow({
				where: { id: job.semesterId },
			});
			if (semester.phase !== "PLANNING")
				throw new AppError(409, "Semester left PLANNING during generation");
			const current = await loadRoutineInputFromDB(tx, job.semesterId);
			const validation = validateRoutine({
				...current,
				entries: result.entries,
			});
			if (!validation.ok)
				throw new AppError(
					409,
					"Schedule resources changed during generation; generate again",
				);
			const placedIds = new Set(result.entries.map((row) => row.sectionId));
			const unplaced = current.sections
				.filter((row) => !placedIds.has(row.id))
				.map(
					(row) =>
						result.report.unplaced.find(
							(item) => item.sectionId === row.id,
						) ?? {
							sectionId: row.id,
							reason: "Section was added during generation",
						},
				);
			const last = await tx.routine.aggregate({
				where: { semesterId: job.semesterId },
				_max: { version: true },
			});
			const routine = await tx.routine.create({
				data: {
					semesterId: job.semesterId,
					version: (last._max.version ?? 0) + 1,
					score: result.score,
					report: {
						...result.report,
						unplaced,
					} as unknown as Prisma.InputJsonValue,
					entries: { createMany: { data: result.entries } },
				},
			});
			await tx.generationJob.update({
				where: { id: jobId },
				data: {
					status: "SUCCEEDED",
					progress: 100,
					resultId: routine.id,
					finishedAt: new Date(),
					error: null,
				},
			});
			return routine.id;
		}, transactionOptions);
	} catch (error) {
		await progressWrites.catch(() => {});
		await prisma.generationJob.updateMany({
			where: { id: jobId, status: "RUNNING" },
			data: {
				status: "FAILED",
				error:
					error instanceof AppError
						? error.message
						: "Routine generation failed; try again",
				finishedAt: new Date(),
			},
		});
	}
};

const routineInclude = {
	semester: true,
	entries: {
		include: {
			room: true,
			dayPattern: true,
			timeSlot: true,
			section: {
				include: {
					faculty: { select: { id: true, name: true, email: true } },
					offering: { include: { course: true } },
				},
			},
		},
		orderBy: [
			{ section: { offering: { course: { code: "asc" } } } },
			{ section: { sectionNo: "asc" } },
		],
	},
} satisfies Prisma.RoutineInclude;

const getAllRoutinesFromDB = async (query: IRoutineListQuery) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: query.semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(404, "Semester not found");
	const where: Prisma.RoutineWhereInput = {
		semesterId: query.semesterId,
		...(query.searchTerm
			? {
					semester: {
						OR: [
							{ name: { contains: query.searchTerm, mode: "insensitive" } },
							{ code: { contains: query.searchTerm, mode: "insensitive" } },
						],
					},
				}
			: {}),
	};
	const [rows, total, sections] = await prisma.$transaction([
		prisma.routine.findMany({
			where,
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
			include: { entries: { select: { sectionId: true } } },
		}),
		prisma.routine.count({ where }),
		prisma.section.findMany({
			where: {
				offering: { semesterId: query.semesterId },
				status: { not: "CANCELLED" },
			},
			select: { id: true },
		}),
	]);
	const data = rows.map(({ entries, ...row }) => {
		const placed = new Set(entries.map((entry) => entry.sectionId));
		return {
			...row,
			entryCount: entries.length,
			unplacedCount: sections.filter((section) => !placed.has(section.id))
				.length,
		};
	});
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

const getRoutineByIdFromDB = async (id: string, query: IRoutineViewQuery) => {
	const routine = await prisma.routine.findUnique({
		where: { id },
		include: routineInclude,
	});
	if (!routine) throw new AppError(404, "Routine not found");
	let courseIds: Set<string> | undefined;
	if (query.programId)
		courseIds = new Set(
			(
				await prisma.curriculumCourse.findMany({
					where: {
						programId: query.programId,
						...(query.term ? { term: query.term } : {}),
					},
					select: { courseId: true },
				})
			).map((row) => row.courseId),
		);
	const entries = routine.entries.filter(
		(entry) =>
			(!query.facultyId || entry.section.facultyId === query.facultyId) &&
			(!query.roomId || entry.roomId === query.roomId) &&
			(!courseIds || courseIds.has(entry.section.offering.courseId)),
	);
	return { ...routine, view: query.view, entries };
};

const getRoutineReportFromDB = async (id: string) => {
	const routine = await prisma.routine.findUnique({
		where: { id },
		include: { entries: true },
	});
	if (!routine) throw new AppError(404, "Routine not found");
	const input = await prisma.$transaction(
		(tx) => loadRoutineInputFromDB(tx, routine.semesterId),
		transactionOptions,
	);
	const validation = validateRoutine({ ...input, entries: routine.entries });
	const score = scoreRoutine(input, routine.entries);
	const placed = new Set(routine.entries.map((entry) => entry.sectionId));
	const saved = routine.report as {
		unplaced?: { sectionId: string; reason: string }[];
	} | null;
	const unplaced = input.sections
		.filter((section) => !placed.has(section.id))
		.map((section) => ({
			sectionId: section.id,
			reason:
				saved?.unplaced?.find((row) => row.sectionId === section.id)?.reason ??
				"Section is not placed in this version",
		}));
	return {
		routineId: id,
		score: score.total,
		softRules: score.breakdown,
		unplaced,
		validation,
	};
};

async function getDraftRoutine(tx: Prisma.TransactionClient, id: string) {
	const routine = await tx.routine.findUnique({
		where: { id },
		include: { entries: true },
	});
	if (!routine) throw new AppError(404, "Routine not found");
	if (routine.status !== "DRAFT")
		throw new AppError(409, "Only draft routines may be edited");
	return routine;
}

async function saveEditedRoutine(
	tx: Prisma.TransactionClient,
	routine: Awaited<ReturnType<typeof getDraftRoutine>>,
	entries: typeof routine.entries,
	changedIds: Set<string>,
) {
	const input = await loadRoutineInputFromDB(tx, routine.semesterId);
	const validation = validateRoutine({ ...input, entries });
	const conflicts = validation.violations.filter((row) =>
		row.sectionIds.some((id) => changedIds.has(id)),
	);
	if (conflicts.length)
		throw new AppError(409, conflicts[0].message, {
			code: "HARD_RULE_VIOLATION",
			violations: conflicts,
		});
	const score = scoreRoutine(input, entries);
	const placed = new Set(entries.map((row) => row.sectionId));
	const previous = routine.report as {
		unplaced?: { sectionId: string; reason: string }[];
	} | null;
	const unplaced = input.sections
		.filter((row) => !placed.has(row.id))
		.map((row) => ({
			sectionId: row.id,
			reason:
				previous?.unplaced?.find((item) => item.sectionId === row.id)?.reason ??
				"Section is not placed in this version",
		}));
	await tx.routine.update({
		where: { id: routine.id },
		data: {
			score: score.total,
			report: {
				softRules: score.breakdown,
				unplaced,
				validation,
			} as unknown as Prisma.InputJsonValue,
		},
	});
	return { score: score.total, violations: validation.violations };
}

const moveRoutineEntryIntoDB = (
	id: string,
	entryId: string,
	payload: IRoutineEntryChange,
) =>
	prisma.$transaction(async (tx) => {
		const routine = await getDraftRoutine(tx, id);
		const entry = routine.entries.find((row) => row.id === entryId);
		if (!entry) throw new AppError(404, "Entry not found in this routine");
		const proposed = routine.entries.map((row) =>
			row.id === entryId ? { ...row, ...payload } : row,
		);
		const result = await saveEditedRoutine(
			tx,
			routine,
			proposed,
			new Set([entry.sectionId]),
		);
		const after = await tx.routineEntry.update({
			where: { id: entryId },
			data: payload,
		});
		return { entry: after, ...result };
	}, transactionOptions);

const swapRoutineEntriesIntoDB = (
	id: string,
	entryAId: string,
	entryBId: string,
) =>
	prisma.$transaction(async (tx) => {
		const routine = await getDraftRoutine(tx, id);
		const a = routine.entries.find((row) => row.id === entryAId);
		const b = routine.entries.find((row) => row.id === entryBId);
		if (!a || !b)
			throw new AppError(404, "Both entries must belong to this routine");
		const schedule = (entry: typeof a) => ({
			roomId: entry.roomId,
			dayPatternId: entry.dayPatternId,
			timeSlotId: entry.timeSlotId,
		});
		const proposed = routine.entries.map((row) =>
			row.id === a.id
				? { ...row, ...schedule(b) }
				: row.id === b.id
					? { ...row, ...schedule(a) }
					: row,
		);
		const result = await saveEditedRoutine(
			tx,
			routine,
			proposed,
			new Set([a.sectionId, b.sectionId]),
		);
		const afterA = await tx.routineEntry.update({
			where: { id: a.id },
			data: schedule(b),
		});
		const afterB = await tx.routineEntry.update({
			where: { id: b.id },
			data: schedule(a),
		});
		return { entries: [afterA, afterB], ...result };
	}, transactionOptions);

const toggleRoutineEntryPinIntoDB = (id: string, entryId: string) =>
	prisma.$transaction(async (tx) => {
		const routine = await getDraftRoutine(tx, id);
		const entry = routine.entries.find((row) => row.id === entryId);
		if (!entry) throw new AppError(404, "Entry not found in this routine");
		return tx.routineEntry.update({
			where: { id: entryId },
			data: { isPinned: !entry.isPinned },
		});
	}, transactionOptions);

const publishRoutineIntoDB = (id: string) =>
	prisma.$transaction(async (tx) => {
		const routine = await getDraftRoutine(tx, id);
		const semester = await tx.semester.findUniqueOrThrow({
			where: { id: routine.semesterId },
			select: { phase: true },
		});
		if (semester.phase !== "PLANNING")
			throw new AppError(409, "Routine publication requires PLANNING", {
				code: "PHASE_NOT_ALLOWED",
			});
		const input = await loadRoutineInputFromDB(tx, routine.semesterId);
		const placedIds = new Set(routine.entries.map((entry) => entry.sectionId));
		const unplaced = input.sections
			.filter((section) => !placedIds.has(section.id))
			.map((section) => ({ sectionId: section.id, label: section.label }));
		if (unplaced.length)
			throw new AppError(
				409,
				"Every section must be placed before publication",
				{ unplaced },
			);
		const validation = validateRoutine({ ...input, entries: routine.entries });
		if (!validation.ok)
			throw new AppError(409, "Routine violates hard rules", {
				code: "HARD_RULE_VIOLATION",
				violations: validation.violations,
			});
		await tx.routine.updateMany({
			where: { semesterId: routine.semesterId, status: "PUBLISHED" },
			data: { status: "ARCHIVED" },
		});
		if (routine.entries.length) {
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.database_schema))
				throw new Error("Unsupported database schema identifier");
			const sectionsTable = Prisma.raw(
				`"${config.database_schema}"."sections"`,
			);
			await tx.$executeRaw(
				Prisma.sql`UPDATE ${sectionsTable} AS s SET "roomId" = v."roomId", "dayPatternId" = v."dayPatternId", "timeSlotId" = v."timeSlotId", "updatedAt" = CURRENT_TIMESTAMP FROM (VALUES ${Prisma.join(routine.entries.map((entry) => Prisma.sql`(${entry.sectionId}, ${entry.roomId}, ${entry.dayPatternId}, ${entry.timeSlotId})`))}) AS v("id", "roomId", "dayPatternId", "timeSlotId") WHERE s."id" = v."id"`,
			);
		}
		const score = scoreRoutine(input, routine.entries);
		return tx.routine.update({
			where: { id },
			data: {
				status: "PUBLISHED",
				publishedAt: new Date(),
				score: score.total,
				report: {
					unplaced: [],
					softRules: score.breakdown,
					validation,
				} as unknown as Prisma.InputJsonValue,
			},
		});
	}, transactionOptions);

export const routineService = {
	publishRoutineIntoDB,
	moveRoutineEntryIntoDB,
	swapRoutineEntriesIntoDB,
	toggleRoutineEntryPinIntoDB,
	getAllRoutinesFromDB,
	getRoutineByIdFromDB,
	getRoutineReportFromDB,
	loadRoutineInputFromDB,
	requestRoutineGenerationIntoDB,
	processRoutineJobIntoDB,
};
