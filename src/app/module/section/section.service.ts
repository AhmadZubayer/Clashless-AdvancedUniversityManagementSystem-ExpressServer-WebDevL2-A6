import { Prisma } from "../../../generated/prisma/client";
import { validateRoutine } from "../../engine/routineValidator";
import type { IRoutineEntry } from "../../engine/routineValidator";
import { prisma } from "../../lib/prisma";
import { publishSeatEvent } from "../../lib/seatEvents";
import { AppError } from "../../utils/AppError";
import { registrationTotals } from "../../utils/registrationTotals";
import { overlaps } from "../../utils/time";
import { sendEmail } from "../../utils/sendEmail";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import { createNotificationsIntoDB } from "../notification/notification.service";
import type {
	ICreateSection,
	ISectionSchedule,
	IUpdateSection,
	IFacultyAssignments,
} from "./section.interface";

const sectionInclude = {
	offering: { include: { course: true, semester: true } },
	dayPattern: true,
	timeSlot: true,
} satisfies Prisma.SectionInclude;
const transactionOptions = {
	isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
	timeout: 15000,
};

async function getSection(tx: Prisma.TransactionClient, id: string) {
	const section = await tx.section.findUnique({
		where: { id },
		include: sectionInclude,
	});
	if (!section) throw new AppError(404, "Section not found");
	return section;
}

async function checkFacultyLoad(
	tx: Prisma.TransactionClient,
	semesterId: string,
	assignments: Map<string, string | null>,
) {
	const sections = await tx.section.findMany({
		where: { offering: { semesterId }, status: { not: "CANCELLED" } },
		include: { offering: { include: { course: true } } },
	});
	const loads = new Map<string, Prisma.Decimal>();
	for (const section of sections) {
		const facultyId = assignments.has(section.id)
			? assignments.get(section.id)
			: section.facultyId;
		if (facultyId)
			loads.set(
				facultyId,
				(loads.get(facultyId) ?? new Prisma.Decimal(0)).plus(
					section.offering.course.credits,
				),
			);
	}
	const targetIds = [
		...new Set([...assignments.values()].filter((id): id is string => !!id)),
	];
	const faculty = await tx.faculty.findMany({
		where: {
			id: { in: targetIds },
			isDeleted: false,
			user: { status: "ACTIVE" },
		},
	});
	if (faculty.length !== targetIds.length)
		throw new AppError(404, "Active teacher not found");
	for (const teacher of faculty) {
		if (loads.get(teacher.id)?.gt(teacher.maxCreditLoad))
			throw new AppError(409, "Teacher credit load exceeds the maximum", {
				facultyId: teacher.id,
				totalCredits: loads.get(teacher.id)?.toString(),
				maxCreditLoad: teacher.maxCreditLoad.toString(),
			});
	}
}

async function checkSchedule(
	tx: Prisma.TransactionClient,
	semesterId: string,
	changedIds: Set<string>,
	overrides: Map<string, Partial<IRoutineEntry>> = new Map(),
	facultyAssignments = new Map<string, string | null>(),
) {
	const [rows, rooms, timeSlots, dayPatterns, preferences] = await Promise.all([
		tx.section.findMany({
			where: { offering: { semesterId }, status: { not: "CANCELLED" } },
			include: { offering: { include: { course: true } } },
		}),
		tx.room.findMany(),
		tx.timeSlot.findMany(),
		tx.dayPattern.findMany(),
		tx.facultySlotPreference.findMany({ where: { semesterId } }),
	]);
	const entries: IRoutineEntry[] = [];
	for (const row of rows) {
		const candidate = {
			sectionId: row.id,
			roomId: row.roomId,
			dayPatternId: row.dayPatternId,
			timeSlotId: row.timeSlotId,
			...overrides.get(row.id),
		};
		if (candidate.roomId && candidate.dayPatternId && candidate.timeSlotId)
			entries.push(candidate as IRoutineEntry);
	}
	const result = validateRoutine({
		sections: rows.map((row) => ({
			id: row.id,
			capacity: row.capacity,
			type: row.offering.course.type,
			facultyId: facultyAssignments.has(row.id)
				? (facultyAssignments.get(row.id) ?? null)
				: row.facultyId,
		})),
		rooms,
		timeSlots,
		dayPatterns,
		preferences,
		entries,
	});
	const violations = result.violations.filter((violation) =>
		violation.sectionIds.some((id) => changedIds.has(id)),
	);
	if (violations.length)
		throw new AppError(409, violations[0].message, {
			code: "HARD_RULE_VIOLATION",
			violations,
		});
}

const createSectionIntoDB = (payload: ICreateSection) =>
	prisma.$transaction(async (tx) => {
		const offering = await tx.courseOffering.findUnique({
			where: { id: payload.offeringId },
			include: { semester: true },
		});
		if (!offering) throw new AppError(404, "Offering not found");
		if (!["PLANNING", "REGISTRATION"].includes(offering.semester.phase))
			throw new AppError(
				409,
				"Extra sections require PLANNING or REGISTRATION",
				{ code: "PHASE_NOT_ALLOWED" },
			);
		const published = await tx.routine.findFirst({
			where: { semesterId: offering.semesterId, status: "PUBLISHED" },
		});
		const hasSchedule = !!(
			payload.roomId &&
			payload.dayPatternId &&
			payload.timeSlotId
		);
		if (
			(published ||
				payload.roomId ||
				payload.dayPatternId ||
				payload.timeSlotId) &&
			!hasSchedule
		)
			throw new AppError(
				409,
				"Room, day pattern and time slot are required together",
				{ code: "HARD_RULE_VIOLATION" },
			);
		const last = await tx.section.aggregate({
			where: { offeringId: offering.id },
			_max: { sectionNo: true },
		});
		// Validate references before writing so invalid schedules consistently return 409.
		if (hasSchedule) {
			const [room, pattern, slot] = await Promise.all([
				tx.room.findUnique({ where: { id: payload.roomId } }),
				tx.dayPattern.findUnique({ where: { id: payload.dayPatternId } }),
				tx.timeSlot.findUnique({ where: { id: payload.timeSlotId } }),
			]);
			if (!room || !pattern || !slot)
				throw new AppError(409, "Schedule resource not found", {
					code: "HARD_RULE_VIOLATION",
				});
		}
		if (
			payload.facultyId &&
			!(await tx.faculty.findFirst({
				where: {
					id: payload.facultyId,
					isDeleted: false,
					user: { status: "ACTIVE" },
				},
			}))
		)
			throw new AppError(404, "Active teacher not found");
		const section = await tx.section.create({
			data: { ...payload, sectionNo: (last._max.sectionNo ?? 0) + 1 },
		});
		await checkFacultyLoad(
			tx,
			offering.semesterId,
			new Map([[section.id, section.facultyId]]),
		);
		await checkSchedule(tx, offering.semesterId, new Set([section.id]));
		if (
			published &&
			payload.roomId &&
			payload.dayPatternId &&
			payload.timeSlotId
		)
			await tx.routineEntry.create({
				data: {
					routineId: published.id,
					sectionId: section.id,
					roomId: payload.roomId,
					dayPatternId: payload.dayPatternId,
					timeSlotId: payload.timeSlotId,
				},
			});
		return section;
	}, transactionOptions);

const updateSectionIntoDB = async (
	id: string,
	payload: IUpdateSection,
	actorId: string,
) => {
	const result = await prisma.$transaction(async (tx) => {
		const before = await getSection(tx, id);
		if (before.status === "CANCELLED")
			throw new AppError(409, "Cancelled sections cannot be updated");
		if (
			payload.capacity !== undefined &&
			payload.capacity < before.enrolledCount
		)
			throw new AppError(409, "Capacity cannot be below enrolled count");
		if (payload.facultyId !== undefined)
			await checkFacultyLoad(
				tx,
				before.offering.semesterId,
				new Map([[id, payload.facultyId]]),
			);
		const after = await tx.section.update({ where: { id }, data: payload });
		await checkSchedule(tx, before.offering.semesterId, new Set([id]));
		await createAuditLogIntoDB(tx, {
			actorId,
			action:
				payload.capacity !== undefined
					? "SECTION_CAPACITY_CHANGED"
					: "SECTION_UPDATED",
			entity: "Section",
			entityId: id,
			before: {
				capacity: before.capacity,
				status: before.status,
				facultyId: before.facultyId,
			},
			after: {
				capacity: after.capacity,
				status: after.status,
				facultyId: after.facultyId,
			},
		});
		return { section: after, semesterId: before.offering.semesterId };
	}, transactionOptions);
	if (payload.capacity !== undefined)
		await publishSeatEvent(result.semesterId, {
			sectionId: id,
			enrolledCount: result.section.enrolledCount,
			capacity: result.section.capacity,
		});
	return result.section;
};

const rescheduleSectionIntoDB = async (
	id: string,
	payload: ISectionSchedule & { reason: string },
	actorId: string,
) => {
	const result = await prisma.$transaction(async (tx) => {
		const before = await getSection(tx, id);
		if (before.status === "CANCELLED")
			throw new AppError(409, "Cancelled sections cannot be rescheduled");
		const entry = await tx.routineEntry.findFirst({
			where: { sectionId: id, routine: { status: "PUBLISHED" } },
		});
		if (!entry)
			throw new AppError(409, "Section is not in a published routine");
		const schedule = {
			roomId: payload.roomId,
			dayPatternId: payload.dayPatternId,
			timeSlotId: payload.timeSlotId,
		};
		await checkSchedule(
			tx,
			before.offering.semesterId,
			new Set([id]),
			new Map([[id, schedule]]),
		);
		const pattern = await tx.dayPattern.findUniqueOrThrow({
			where: { id: payload.dayPatternId },
		});
		const slot = await tx.timeSlot.findUniqueOrThrow({
			where: { id: payload.timeSlotId },
		});
		const enrolled = await tx.enrollment.findMany({
			where: { sectionId: id, status: "ENROLLED" },
			include: { student: true },
		});
		const others = await tx.enrollment.findMany({
			where: {
				semesterId: before.offering.semesterId,
				status: "ENROLLED",
				sectionId: { not: id },
				studentId: { in: enrolled.map((row) => row.studentId) },
			},
			include: { section: { include: { dayPattern: true, timeSlot: true } } },
		});
		const clashes = enrolled
			.filter((row) =>
				others.some(
					(other) =>
						other.studentId === row.studentId &&
						other.section.dayPattern?.days.some((day) =>
							pattern.days.includes(day),
						) &&
						other.section.timeSlot &&
						overlaps(slot, other.section.timeSlot),
				),
			)
			.map((row) => ({
				studentId: row.studentId,
				universityId: row.student.universityId,
			}));
		if (clashes.length)
			throw new AppError(
				409,
				"Rescheduling would clash for enrolled students",
				{ code: "TIME_CLASH", students: clashes },
			);
		const after = await tx.section.update({ where: { id }, data: schedule });
		await tx.routineEntry.update({ where: { id: entry.id }, data: schedule });
		await createAuditLogIntoDB(tx, {
			actorId,
			action: "SECTION_RESCHEDULED",
			entity: "Section",
			entityId: id,
			reason: payload.reason,
			before: {
				roomId: before.roomId,
				dayPatternId: before.dayPatternId,
				timeSlotId: before.timeSlotId,
			},
			after: schedule,
		});
		return {
			section: after,
			students: enrolled.map((row) => row.student),
			course: before.offering.course.code,
		};
	}, transactionOptions);
	await Promise.all(
		result.students.map((student) =>
			sendEmail({
				to: student.email,
				subject: `${result.course} section schedule changed`,
				templateName: "section-rescheduled",
				templateData: {
					name: student.name,
					course: result.course,
					sectionNo: result.section.sectionNo,
					reason: payload.reason,
				},
			}),
		),
	);
	return result.section;
};

const cancelSectionIntoDB = async (
	id: string,
	reason: string,
	actorId: string,
) => {
	const result = await prisma.$transaction(async (tx) => {
		const before = await getSection(tx, id);
		if (before.status === "CANCELLED")
			throw new AppError(409, "Section is already cancelled");
		const enrolled = await tx.enrollment.findMany({
			where: { sectionId: id, status: "ENROLLED" },
			include: { student: { select: { userId: true } } },
		});
		await tx.enrollment.updateMany({
			where: { sectionId: id, status: "ENROLLED" },
			data: { status: "CANCELLED", droppedAt: new Date() },
		});
		const after = await tx.section.update({
			where: { id },
			data: { status: "CANCELLED", enrolledCount: 0 },
		});
		for (const registrationId of new Set(
			enrolled.map((row) => row.registrationId),
		)) {
			const registration = await tx.semesterRegistration.findUniqueOrThrow({
				where: { id: registrationId },
				include: {
					enrollments: {
						where: { status: "ENROLLED" },
						select: { credits: true },
					},
					student: { include: { program: true } },
					semester: true,
				},
			});
			const totals = registrationTotals({
				credits: registration.enrollments.map((row) => row.credits),
				perCreditFee: registration.student.program.perCreditFee,
				semesterFee: registration.student.program.semesterFee,
				paidAmount: registration.paidAmount,
				minPaymentPercent: registration.semester.minPaymentPercent,
			});
			await tx.semesterRegistration.update({
				where: { id: registrationId },
				data: totals,
			});
		}
		await tx.routineEntry.deleteMany({
			where: { sectionId: id, routine: { status: "PUBLISHED" } },
		});
		await createNotificationsIntoDB(
			tx,
			enrolled.map((row) => ({
				userId: row.student.userId,
				type: "SECTION_CANCELLED",
				title: "Section cancelled",
				message: `${before.offering.course.code} section ${before.sectionNo} was cancelled: ${reason}`,
			})),
		);
		await createAuditLogIntoDB(tx, {
			actorId,
			action: "SECTION_CANCELLED",
			entity: "Section",
			entityId: id,
			reason,
			before: { status: before.status, enrolledCount: before.enrolledCount },
			after: { status: after.status, enrolledCount: 0 },
		});
		return { section: after, semesterId: before.offering.semesterId };
	}, transactionOptions);
	await publishSeatEvent(result.semesterId, {
		sectionId: id,
		enrolledCount: 0,
		capacity: result.section.capacity,
	});
	return result.section;
};

const assignFacultyIntoDB = (payload: IFacultyAssignments) =>
	prisma.$transaction(async (tx) => {
		if (
			!(await tx.semester.findUnique({
				where: { id: payload.semesterId },
				select: { id: true },
			}))
		)
			throw new AppError(404, "Semester not found");
		const assignments = new Map(
			payload.assignments.map((row) => [row.sectionId, row.facultyId]),
		);
		const rows = await tx.section.findMany({
			where: {
				id: { in: [...assignments.keys()] },
				offering: { semesterId: payload.semesterId },
				status: { not: "CANCELLED" },
			},
		});
		if (rows.length !== assignments.size)
			throw new AppError(404, "Active section not found in this semester");
		await checkFacultyLoad(tx, payload.semesterId, assignments);
		await checkSchedule(
			tx,
			payload.semesterId,
			new Set(assignments.keys()),
			new Map(),
			assignments,
		);
		for (const [id, facultyId] of assignments)
			await tx.section.update({ where: { id }, data: { facultyId } });
		return tx.section.findMany({
			where: { id: { in: [...assignments.keys()] } },
			orderBy: [{ offeringId: "asc" }, { sectionNo: "asc" }],
		});
	}, transactionOptions);

const getMySectionsFromDB = async (userId: string) => {
	const faculty = await prisma.faculty.findUnique({
		where: { userId },
		select: { id: true },
	});
	if (!faculty) throw new AppError(404, "Faculty profile not found");
	const semester = await prisma.semester.findFirst({
		where: { phase: { not: "CLOSED" } },
		select: { id: true },
	});
	if (!semester) throw new AppError(404, "No current semester");
	return prisma.section.findMany({
		where: {
			facultyId: faculty.id,
			offering: { semesterId: semester.id },
			status: { not: "CANCELLED" },
		},
		include: {
			...sectionInclude,
			room: true,
			_count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
		},
		orderBy: [{ offering: { course: { code: "asc" } } }, { sectionNo: "asc" }],
	});
};

export const sectionService = {
	assignFacultyIntoDB,
	getMySectionsFromDB,
	createSectionIntoDB,
	updateSectionIntoDB,
	rescheduleSectionIntoDB,
	cancelSectionIntoDB,
};
