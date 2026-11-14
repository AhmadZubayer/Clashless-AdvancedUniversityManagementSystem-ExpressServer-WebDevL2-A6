import { Prisma } from "../../../generated/prisma/client";
import {
	buildExamReport,
	generateExamRoutine,
} from "../../engine/examRoutineGenerator";
import type { IExamRoutineReport } from "../../engine/examRoutineGenerator";
import { validateExamRoutine } from "../../engine/examRoutineValidator";
import type {
	IExamOffering,
	IExamSlotInput,
} from "../../engine/examRoutineValidator";
import { queueEmail } from "../../jobs/email";
import { enqueueJob } from "../../lib/queue";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { minutesToTime } from "../../utils/time";
import type {
	IExamRoutineListQuery,
	IGenerateExamRoutine,
} from "./examRoutine.interface";
import "../../jobs/examRoutine";

const transactionOptions = {
	isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
	timeout: 15000,
};

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

async function loadExamInputFromDB(
	tx: Prisma.TransactionClient,
	semesterId: string,
) {
	const [slotRows, enrollments] = await Promise.all([
		tx.examSlot.findMany({
			where: { semesterId },
			orderBy: [{ date: "asc" }, { startMinute: "asc" }],
		}),
		tx.enrollment.findMany({
			where: { semesterId, status: "ENROLLED" },
			select: {
				offeringId: true,
				studentId: true,
				offering: {
					select: { course: { select: { code: true, title: true } } },
				},
			},
		}),
	]);
	const slots: IExamSlotInput[] = slotRows.map((slot) => ({
		id: slot.id,
		date: dateOnly(slot.date),
		startMinute: slot.startMinute,
		endMinute: slot.endMinute,
	}));
	const offerings = new Map<string, IExamOffering & { title: string }>();
	for (const row of enrollments) {
		const existing = offeringsEntry(offerings, row);
		existing.studentIds.push(row.studentId);
	}
	return { slots, offerings: [...offerings.values()] };
}

function offeringsEntry(
	map: Map<string, IExamOffering & { title: string }>,
	row: {
		offeringId: string;
		offering: { course: { code: string; title: string } };
	},
) {
	let entry = map.get(row.offeringId);
	if (!entry) {
		entry = {
			id: row.offeringId,
			label: row.offering.course.code,
			title: row.offering.course.title,
			studentIds: [],
		};
		map.set(row.offeringId, entry);
	}
	return entry;
}

const requestExamRoutineGenerationIntoDB = async (
	actorId: string,
	payload: IGenerateExamRoutine,
) => {
	const job = await prisma.$transaction(async (tx) => {
		const semester = await tx.semester.findUnique({
			where: { id: payload.semesterId },
			select: { phase: true },
		});
		if (!semester) throw new AppError(404, "Semester not found");
		if (semester.phase !== "CLASSES")
			throw new AppError(409, "Exam routine generation requires CLASSES", {
				code: "PHASE_NOT_ALLOWED",
			});
		if (
			!(await tx.examSlot.count({ where: { semesterId: payload.semesterId } }))
		)
			throw new AppError(409, "Create exam slots first");
		return tx.generationJob.create({
			data: {
				type: "EXAM_ROUTINE",
				semesterId: payload.semesterId,
				createdById: actorId,
				input: { maxStudentsPerSlot: payload.maxStudentsPerSlot },
			},
		});
	}, transactionOptions);
	try {
		await enqueueJob("exam-routine", { jobId: job.id }, job.id);
	} catch {
		await prisma.generationJob.updateMany({
			where: { id: job.id, status: "QUEUED" },
			data: {
				status: "FAILED",
				error: "Could not queue exam routine generation",
				finishedAt: new Date(),
			},
		});
		throw new AppError(500, "Could not queue exam routine generation");
	}
	return { jobId: job.id };
};

const processExamRoutineJobIntoDB = async (jobId: string) => {
	const claimed = await prisma.generationJob.updateMany({
		where: { id: jobId, type: "EXAM_ROUTINE", status: "QUEUED" },
		data: { status: "RUNNING", startedAt: new Date(), progress: 0 },
	});
	if (!claimed.count) return;
	try {
		const job = await prisma.generationJob.findUniqueOrThrow({
			where: { id: jobId },
		});
		const { maxStudentsPerSlot } = job.input as { maxStudentsPerSlot: number };
		const input = await prisma.$transaction(
			(tx) => loadExamInputFromDB(tx, job.semesterId),
			transactionOptions,
		);
		const result = generateExamRoutine({
			offerings: input.offerings,
			slots: input.slots,
			maxStudentsPerSlot,
		});
		const routineId = await prisma.$transaction(async (tx) => {
			const last = await tx.examRoutine.aggregate({
				where: { semesterId: job.semesterId },
				_max: { version: true },
			});
			const routine = await tx.examRoutine.create({
				data: {
					semesterId: job.semesterId,
					version: (last._max.version ?? 0) + 1,
					report: result.report as unknown as Prisma.InputJsonValue,
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
		return routineId;
	} catch (error) {
		await prisma.generationJob.updateMany({
			where: { id: jobId, status: "RUNNING" },
			data: {
				status: "FAILED",
				error:
					error instanceof AppError
						? error.message
						: "Exam routine generation failed; try again",
				finishedAt: new Date(),
			},
		});
	}
};

const getAllExamRoutinesFromDB = async (query: IExamRoutineListQuery) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: query.semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(404, "Semester not found");
	const where = { semesterId: query.semesterId };
	const [rows, total] = await prisma.$transaction([
		prisma.examRoutine.findMany({
			where,
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
			include: { _count: { select: { entries: true } } },
		}),
		prisma.examRoutine.count({ where }),
	]);
	return {
		data: rows.map(({ _count, ...row }) => ({
			...row,
			entryCount: _count.entries,
		})),
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};

const getExamRoutineByIdFromDB = async (id: string) => {
	const routine = await prisma.examRoutine.findUnique({
		where: { id },
		include: {
			entries: {
				include: {
					offering: {
						select: {
							course: { select: { code: true, title: true } },
							_count: {
								select: { enrollments: { where: { status: "ENROLLED" } } },
							},
						},
					},
				},
			},
		},
	});
	if (!routine) throw new AppError(404, "Exam routine not found");
	const slots = await prisma.examSlot.findMany({
		where: { semesterId: routine.semesterId },
		orderBy: [{ date: "asc" }, { startMinute: "asc" }],
	});
	const { entries, ...rest } = routine;
	return {
		...rest,
		slots: slots.map((slot) => {
			const rows = entries
				.filter((entry) => entry.examSlotId === slot.id)
				.map((entry) => ({
					entryId: entry.id,
					offeringId: entry.offeringId,
					code: entry.offering.course.code,
					title: entry.offering.course.title,
					studentCount: entry.offering._count.enrollments,
				}));
			return {
				...slot,
				entries: rows,
				studentCount: rows.reduce((sum, row) => sum + row.studentCount, 0),
			};
		}),
	};
};

const moveExamEntryIntoDB = (id: string, entryId: string, examSlotId: string) =>
	prisma.$transaction(async (tx) => {
		const routine = await tx.examRoutine.findUnique({
			where: { id },
			include: { entries: true },
		});
		if (!routine) throw new AppError(404, "Exam routine not found");
		if (routine.status !== "DRAFT")
			throw new AppError(409, "Only draft exam routines may be edited");
		const entry = routine.entries.find((row) => row.id === entryId);
		if (!entry) throw new AppError(404, "Exam routine entry not found");
		const slot = await tx.examSlot.findUnique({ where: { id: examSlotId } });
		if (!slot || slot.semesterId !== routine.semesterId)
			throw new AppError(404, "Exam slot not found in this semester");
		const input = await loadExamInputFromDB(tx, routine.semesterId);
		const byId = new Map(input.offerings.map((row) => [row.id, row]));
		const moving = byId.get(entry.offeringId);
		if (!moving)
			throw new AppError(409, "This course has no enrolled students");
		const mine = new Set(moving.studentIds);
		const others = routine.entries.filter(
			(row) => row.examSlotId === examSlotId && row.id !== entry.id,
		);
		const clashing = new Map<string, string>();
		let students = moving.studentIds.length;
		for (const other of others) {
			const offering = byId.get(other.offeringId);
			for (const studentId of offering?.studentIds ?? []) {
				students += 1;
				if (mine.has(studentId)) clashing.set(studentId, offering?.label ?? "");
			}
		}
		if (clashing.size) {
			const students = await tx.student.findMany({
				where: { id: { in: [...clashing.keys()] } },
				select: { id: true, universityId: true, name: true },
			});
			throw new AppError(
				409,
				"Some students already have an exam in that slot",
				{
					code: "HARD_RULE_VIOLATION",
					students: students.map((row) => ({
						...row,
						clashesWith: clashing.get(row.id),
					})),
				},
			);
		}
		const max = (routine.report as { maxStudentsPerSlot?: number } | null)
			?.maxStudentsPerSlot;
		if (max && students > max)
			throw new AppError(409, "That slot would go over its seat limit", {
				code: "HARD_RULE_VIOLATION",
				students,
				maxStudentsPerSlot: max,
			});
		await tx.examRoutineEntry.update({
			where: { id: entry.id },
			data: { examSlotId },
		});
		const entries = routine.entries.map((row) =>
			row.id === entry.id ? { ...row, examSlotId } : row,
		);
		const unplaced = (
			(routine.report as IExamRoutineReport | null)?.unplaced ?? []
		).filter((row) => row.offeringId !== entry.offeringId);
		const report = buildExamReport(
			max ?? Number.MAX_SAFE_INTEGER,
			input.slots,
			entries,
			byId,
			unplaced,
		);
		return tx.examRoutine.update({
			where: { id },
			data: {
				report: {
					...report,
					maxStudentsPerSlot: max ?? null,
				} as unknown as Prisma.InputJsonValue,
			},
			include: { entries: true },
		});
	}, transactionOptions);

const publishExamRoutineIntoDB = async (id: string) => {
	const result = await prisma.$transaction(async (tx) => {
		const routine = await tx.examRoutine.findUnique({
			where: { id },
			include: { entries: true },
		});
		if (!routine) throw new AppError(404, "Exam routine not found");
		if (routine.status !== "DRAFT")
			throw new AppError(409, "Only draft exam routines can be published");
		const semester = await tx.semester.findUniqueOrThrow({
			where: { id: routine.semesterId },
			select: { phase: true },
		});
		if (semester.phase !== "CLASSES")
			throw new AppError(409, "Publishing requires CLASSES", {
				code: "PHASE_NOT_ALLOWED",
			});
		const input = await loadExamInputFromDB(tx, routine.semesterId);
		const max = (routine.report as { maxStudentsPerSlot?: number } | null)
			?.maxStudentsPerSlot;
		const validation = validateExamRoutine({
			offerings: input.offerings,
			slots: input.slots,
			entries: routine.entries,
			maxStudentsPerSlot: max ?? undefined,
		});
		if (!validation.ok)
			throw new AppError(409, "The exam routine breaks a hard rule", {
				code: "HARD_RULE_VIOLATION",
				violations: validation.violations,
			});
		await tx.examRoutine.updateMany({
			where: { semesterId: routine.semesterId, status: "PUBLISHED" },
			data: { status: "ARCHIVED" },
		});
		await tx.courseOffering.updateMany({
			where: { semesterId: routine.semesterId },
			data: { examSlotId: null },
		});
		const bySlot = new Map<string, string[]>();
		for (const entry of routine.entries)
			bySlot.set(entry.examSlotId, [
				...(bySlot.get(entry.examSlotId) ?? []),
				entry.offeringId,
			]);
		for (const [slotId, offeringIds] of bySlot)
			await tx.courseOffering.updateMany({
				where: { id: { in: offeringIds } },
				data: { examSlotId: slotId },
			});
		const published = await tx.examRoutine.update({
			where: { id },
			data: { status: "PUBLISHED", publishedAt: new Date() },
		});
		return { published, input, entries: routine.entries };
	}, transactionOptions);
	await emailStudentsTheirExams(result.input, result.entries);
	return result.published;
};

async function emailStudentsTheirExams(
	input: Awaited<ReturnType<typeof loadExamInputFromDB>>,
	entries: { offeringId: string; examSlotId: string }[],
) {
	const slotById = new Map(input.slots.map((slot) => [slot.id, slot]));
	const exams = new Map<string, { course: string; when: string }[]>();
	for (const entry of entries) {
		const slot = slotById.get(entry.examSlotId);
		const offering = input.offerings.find((row) => row.id === entry.offeringId);
		if (!slot || !offering) continue;
		for (const studentId of offering.studentIds)
			exams.set(studentId, [
				...(exams.get(studentId) ?? []),
				{
					course: offering.label,
					when: `${slot.date} ${minutesToTime(slot.startMinute)}-${minutesToTime(slot.endMinute)}`,
				},
			]);
	}
	const students = await prisma.student.findMany({
		where: { id: { in: [...exams.keys()] } },
		select: { id: true, name: true, email: true },
	});
	for (const student of students) {
		try {
			await queueEmail({
				to: student.email,
				subject: "Your exam routine is published",
				templateName: "exam-routine-published",
				templateData: { name: student.name, exams: exams.get(student.id) },
			});
		} catch {
			// a failed email never blocks publication
		}
	}
}

const getMyExamRoutineFromDB = async (actor: RequestUser) => {
	const semester = await prisma.semester.findFirst({
		where: { phase: { not: "CLOSED" } },
		select: { id: true },
	});
	if (!semester) throw new AppError(404, "No current semester");
	const slotSelect = {
		id: true,
		date: true,
		startMinute: true,
		endMinute: true,
	};
	if (actor.role === "FACULTY") {
		const teacher = await prisma.faculty.findUnique({
			where: { userId: actor.id },
			select: { id: true },
		});
		if (!teacher) throw new AppError(404, "Faculty profile not found");
		const [sections, duties] = await Promise.all([
			prisma.section.findMany({
				where: {
					facultyId: teacher.id,
					offering: { semesterId: semester.id, examSlotId: { not: null } },
				},
				select: {
					sectionNo: true,
					offering: {
						select: {
							course: { select: { code: true, title: true } },
							examSlot: { select: slotSelect },
						},
					},
				},
			}),
			prisma.invigilatorAssignment.findMany({
				where: {
					facultyId: teacher.id,
					seatPlan: { semesterId: semester.id, status: "PUBLISHED" },
				},
				select: {
					room: { select: { roomNo: true } },
					seatPlan: { select: { examSlot: { select: slotSelect } } },
				},
			}),
		]);
		return {
			semesterId: semester.id,
			exams: sections.map((row) => ({
				course: row.offering.course,
				sectionNo: row.sectionNo,
				examSlot: row.offering.examSlot,
			})),
			invigilation: duties.map((row) => ({
				roomNo: row.room.roomNo,
				examSlot: row.seatPlan.examSlot,
			})),
		};
	}
	const student = await prisma.student.findUnique({
		where: { userId: actor.id },
		select: { id: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	const [enrollments, seats] = await Promise.all([
		prisma.enrollment.findMany({
			where: {
				studentId: student.id,
				semesterId: semester.id,
				status: "ENROLLED",
			},
			select: {
				offeringId: true,
				offering: {
					select: {
						course: { select: { code: true, title: true } },
						examSlot: { select: slotSelect },
					},
				},
			},
		}),
		prisma.seatAssignment.findMany({
			where: {
				studentId: student.id,
				seatPlan: { semesterId: semester.id, status: "PUBLISHED" },
			},
			select: {
				offeringId: true,
				column: true,
				seatNo: true,
				label: true,
				room: { select: { roomNo: true } },
				seatPlan: { select: { examSlotId: true } },
			},
		}),
	]);
	return {
		semesterId: semester.id,
		exams: enrollments
			.filter((row) => row.offering.examSlot)
			.map((row) => {
				const seat = seats.find(
					(item) =>
						item.seatPlan.examSlotId === row.offering.examSlot?.id &&
						item.offeringId === row.offeringId,
				);
				return {
					course: row.offering.course,
					examSlot: row.offering.examSlot,
					seat: seat
						? {
								roomNo: seat.room.roomNo,
								column: seat.column,
								seatNo: seat.seatNo,
								label: seat.label,
							}
						: null,
				};
			})
			.sort(
				(a, b) =>
					(a.examSlot?.date.getTime() ?? 0) -
						(b.examSlot?.date.getTime() ?? 0) ||
					(a.examSlot?.startMinute ?? 0) - (b.examSlot?.startMinute ?? 0),
			),
	};
};

export const examRoutineService = {
	requestExamRoutineGenerationIntoDB,
	processExamRoutineJobIntoDB,
	getAllExamRoutinesFromDB,
	getExamRoutineByIdFromDB,
	moveExamEntryIntoDB,
	publishExamRoutineIntoDB,
	getMyExamRoutineFromDB,
};
