import {
	Prisma,
	type SemesterRegistration,
} from "../../../generated/prisma/client";
import { randomUUID } from "node:crypto";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { redisClient, redisKey } from "../../lib/redis";
import { publishSeatEvent } from "../../lib/seatEvents";
import { AppError } from "../../utils/AppError";
import { getGradePoint } from "../../utils/grade";
import { registrationTotals } from "../../utils/registrationTotals";
import { formatDhaka, overlaps } from "../../utils/time";
import type {
	IRegistrationCatalogQuery,
	IManualRegistration,
	IAdminRegistrationQuery,
} from "./registration.interface";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";

// Raw writes must use the same schema as Prisma's driver adapter.
function table(name: "semester_registrations") {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.database_schema))
		throw new Error("Unsupported database schema identifier");
	return Prisma.raw(`"${config.database_schema}"."${name}"`);
}

async function getStudentContextFromDB(userId: string) {
	const [student, semester] = await Promise.all([
		prisma.student.findUnique({
			where: { userId },
			include: { program: true },
		}),
		prisma.semester.findFirst({ where: { phase: { not: "CLOSED" } } }),
	]);
	if (!student || student.isDeleted)
		throw new AppError(404, "Student profile not found");
	if (!semester) throw new AppError(404, "No current semester");
	return { student, semester };
}

async function getOpenWindowFromDB(
	studentId: string,
	batchId: string,
	semesterId: string,
) {
	const window = await prisma.registrationWindow.findUnique({
		where: { unique_batch_window: { batchId, semesterId } },
	});
	const now = Date.now();
	if (!window || now < window.startsAt.getTime())
		throw new AppError(
			403,
			window
				? `Your registration opens on ${formatDhaka(window.startsAt)}`
				: "Your batch has no registration window",
			{ code: "WINDOW_NOT_OPEN", studentId },
		);
	if (now > window.endsAt.getTime())
		throw new AppError(
			403,
			`Your registration closed on ${formatDhaka(window.endsAt)}`,
			{ code: "WINDOW_CLOSED" },
		);
	return window;
}

async function lockRegistrationIntoDB(
	tx: Prisma.TransactionClient,
	studentId: string,
	semesterId: string,
	paymentDeadline?: Date,
) {
	const registrationsTable = table("semester_registrations");
	if (paymentDeadline)
		await tx.$executeRaw(
			Prisma.sql`INSERT INTO ${registrationsTable} (id, "studentId", "semesterId", "paymentDeadline", "updatedAt") VALUES (gen_random_uuid()::text, ${studentId}, ${semesterId}, ${paymentDeadline}, now()) ON CONFLICT ("studentId", "semesterId") DO NOTHING`,
		);
	const rows = await tx.$queryRaw<SemesterRegistration[]>(
		Prisma.sql`SELECT * FROM ${registrationsTable} WHERE "studentId" = ${studentId} AND "semesterId" = ${semesterId} FOR UPDATE`,
	);
	if (!rows[0]) throw new AppError(404, "Semester registration not found");
	const registration = rows[0];
	if (registration.status === "DISCARDED")
		throw new AppError(
			403,
			"Your registration was discarded because the minimum payment was not paid in time",
			{ code: "REGISTRATION_DISCARDED" },
		);
	return registration;
}

const scheduleInclude = {
	dayPattern: true,
	timeSlot: true,
	offering: { include: { course: true } },
} satisfies Prisma.SectionInclude;

// Concurrent seat contenders may queue behind row locks over the hosted connection.
// Keep default isolation; allow that queue to drain rather than abort correct writes.
const registrationTransactionOptions = { maxWait: 60000, timeout: 60000 };

async function checkRegistrationRateLimitFromDB(userId: string) {
	const student = await prisma.student.findUnique({
		where: { userId },
		select: { id: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	const count = Number(
		await redisClient.eval(
			"local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], 10000) end; return count",
			{
				keys: [redisKey(`rate-limit-registration:${student.id}`)],
				arguments: [],
			},
		),
	);
	if (count > 10)
		throw new AppError(
			429,
			"Too many registration requests; try again in a few seconds",
			{ code: "RATE_LIMITED" },
		);
}

const selectSectionIntoDB = async (
	userId: string,
	sectionId: string,
	manual?: IManualRegistration & { actorId: string },
) => {
	const { student, semester } = await getStudentContextFromDB(userId);
	if (
		manual
			? !["REGISTRATION", "CLASSES"].includes(semester.phase)
			: semester.phase !== "REGISTRATION"
	)
		throw new AppError(
			409,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	const bypass = new Set(manual?.bypass ?? []);
	const window = bypass.has("WINDOW")
		? await prisma.registrationWindow.findUnique({
				where: {
					unique_batch_window: {
						batchId: student.batchId,
						semesterId: semester.id,
					},
				},
			})
		: await getOpenWindowFromDB(student.id, student.batchId, semester.id);
	// A bypass does not invent a new billing deadline when a batch has no window.
	const paymentDeadline = window
		? new Date(
				window.endsAt.getTime() + semester.paymentDeadlineDays * 86400000,
			)
		: undefined;
	const result = await prisma.$transaction(async (tx) => {
		const registration = await lockRegistrationIntoDB(
			tx,
			student.id,
			semester.id,
			paymentDeadline,
		);
		const section = await tx.section.findFirst({
			where: { id: sectionId, offering: { semesterId: semester.id } },
			include: scheduleInclude,
		});
		if (!section?.timeSlot || !section.dayPattern)
			throw new AppError(404, "Scheduled section not found in this semester");
		if (section.status !== "OPEN")
			throw new AppError(409, "This section is closed", {
				code: "SECTION_CLOSED",
			});
		const enrolled = await tx.enrollment.findMany({
			where: {
				studentId: student.id,
				semesterId: semester.id,
				status: "ENROLLED",
			},
			include: { section: { include: scheduleInclude } },
		});
		const sameCourse = enrolled.find(
			(row) => row.offeringId === section.offeringId,
		);
		if (sameCourse?.sectionId === sectionId)
			return {
				statusCode: 200,
				data: { enrollment: sameCourse, registration },
				seat: null,
			};
		if (sameCourse)
			throw new AppError(
				409,
				`You already have ${section.offering.course.code} (section ${sameCourse.section.sectionNo})`,
				{ code: "ALREADY_HAS_COURSE", sectionId: sameCourse.sectionId },
			);
		const sectionDays = section.dayPattern.days;
		const sectionTime = section.timeSlot;
		const conflict = enrolled.find(
			(row) =>
				row.section.timeSlot &&
				row.section.dayPattern?.days.some((day) => sectionDays.includes(day)) &&
				overlaps(sectionTime, row.section.timeSlot),
		);
		if (conflict && !bypass.has("TIME_CLASH"))
			throw new AppError(
				409,
				`Clashes with ${conflict.section.offering.course.code} section ${conflict.section.sectionNo}`,
				{
					code: "TIME_CLASH",
					sectionId: conflict.sectionId,
					courseCode: conflict.section.offering.course.code,
				},
			);
		if (
			!bypass.has("CREDIT_LIMIT") &&
			registration.totalCredits
				.plus(section.offering.course.credits)
				.gt(semester.maxCredits)
		)
			throw new AppError(
				409,
				`You have ${registration.totalCredits} of ${semester.maxCredits} credits; ${section.offering.course.code} needs ${section.offering.course.credits}`,
				{ code: "CREDIT_LIMIT" },
			);
		const prerequisites = await tx.coursePrerequisite.findMany({
			where: { courseId: section.offering.courseId },
			include: { prerequisite: { select: { code: true } } },
		});
		if (prerequisites.length && !bypass.has("PREREQUISITE")) {
			const results = await tx.courseResult.findMany({
				where: {
					studentId: student.id,
					courseId: { in: prerequisites.map((row) => row.prerequisiteId) },
				},
				select: { courseId: true, gradePoint: true },
			});
			const missing = prerequisites.filter((prerequisite) => {
				const minimum = getGradePoint(prerequisite.minGrade);
				return (
					!minimum ||
					!results.some(
						(row) =>
							row.courseId === prerequisite.prerequisiteId &&
							row.gradePoint.gte(minimum),
					)
				);
			});
			if (missing.length)
				throw new AppError(
					409,
					`${section.offering.course.code} needs ${missing.map((row) => `${row.prerequisite.code} with at least ${row.minGrade}`).join(", ")}`,
					{
						code: "PREREQUISITE_MISSING",
						prerequisites: missing.map((row) => ({
							courseId: row.prerequisiteId,
							code: row.prerequisite.code,
							minGrade: row.minGrade,
						})),
					},
				);
		}
		if (bypass.has("CAPACITY"))
			await tx.section.update({
				where: { id: sectionId },
				data: { capacity: { increment: 1 } },
			});
		const taken = await tx.section.updateMany({
			where: {
				id: sectionId,
				status: "OPEN",
				enrolledCount: { lt: tx.section.fields.capacity },
			},
			data: { enrolledCount: { increment: 1 } },
		});
		if (!taken.count) {
			const alternatives = await tx.section.findMany({
				where: {
					offeringId: section.offeringId,
					id: { not: sectionId },
					status: "OPEN",
					enrolledCount: { lt: tx.section.fields.capacity },
				},
				select: {
					id: true,
					sectionNo: true,
					enrolledCount: true,
					capacity: true,
				},
				orderBy: { sectionNo: "asc" },
			});
			throw new AppError(409, "This section has reached full capacity", {
				code: "SECTION_FULL",
				alternatives,
			});
		}
		const enrollment = await tx.enrollment.upsert({
			where: { unique_student_section: { studentId: student.id, sectionId } },
			create: {
				studentId: student.id,
				semesterId: semester.id,
				registrationId: registration.id,
				sectionId,
				offeringId: section.offeringId,
				credits: section.offering.course.credits,
			},
			update: {
				status: "ENROLLED",
				credits: section.offering.course.credits,
				enrolledAt: new Date(),
				droppedAt: null,
				grade: null,
				gradeSubmittedAt: null,
			},
		});
		const totals = registrationTotals({
			credits: [
				...enrolled.map((row) => row.credits),
				section.offering.course.credits,
			],
			perCreditFee: student.program.perCreditFee,
			semesterFee: student.program.semesterFee,
			paidAmount: registration.paidAmount,
			minPaymentPercent: semester.minPaymentPercent,
		});
		const updatedRegistration = await tx.semesterRegistration.update({
			where: { id: registration.id },
			data: totals,
		});
		const seat = await tx.section.findUniqueOrThrow({
			where: { id: sectionId },
			select: { id: true, enrolledCount: true, capacity: true },
		});
		if (manual)
			await createAuditLogIntoDB(tx, {
				actorId: manual.actorId,
				action: "MANUAL_ENROLL",
				entity: "Enrollment",
				entityId: enrollment.id,
				reason: manual.reason,
				before: {
					totalCredits: registration.totalCredits.toString(),
					totalFee: registration.totalFee.toString(),
					enrolledCount: seat.enrolledCount - 1,
					capacity: seat.capacity - (bypass.has("CAPACITY") ? 1 : 0),
				},
				after: {
					studentId: student.id,
					sectionId,
					bypass: manual.bypass,
					enrolledCount: seat.enrolledCount,
					capacity: seat.capacity,
					totalCredits: updatedRegistration.totalCredits.toString(),
					totalFee: updatedRegistration.totalFee.toString(),
				},
			});
		return {
			statusCode: 201,
			data: { enrollment, registration: updatedRegistration },
			seat,
		};
	}, registrationTransactionOptions);
	if (result.seat)
		await publishSeatEvent(semester.id, {
			sectionId,
			enrolledCount: result.seat.enrolledCount,
			capacity: result.seat.capacity,
		});
	return { statusCode: result.statusCode, data: result.data };
};

const unselectSectionIntoDB = async (
	userId: string,
	sectionId: string,
	manual?: { actorId: string; reason: string },
) => {
	if (!manual) await checkRegistrationRateLimitFromDB(userId);
	const { student, semester } = await getStudentContextFromDB(userId);
	if (
		manual
			? !["REGISTRATION", "CLASSES"].includes(semester.phase)
			: semester.phase !== "REGISTRATION"
	)
		throw new AppError(
			409,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	if (!manual)
		await getOpenWindowFromDB(student.id, student.batchId, semester.id);
	const result = await prisma.$transaction(async (tx) => {
		const registration = await lockRegistrationIntoDB(
			tx,
			student.id,
			semester.id,
		);
		const enrollment = await tx.enrollment.findFirst({
			where: {
				studentId: student.id,
				sectionId,
				semesterId: semester.id,
				status: "ENROLLED",
			},
		});
		if (!enrollment) throw new AppError(404, "Enrolled section not found");
		const dropped = await tx.enrollment.update({
			where: { id: enrollment.id },
			data: { status: "DROPPED", droppedAt: new Date() },
		});
		const released = await tx.section.updateMany({
			where: { id: sectionId, enrolledCount: { gt: 0 } },
			data: { enrolledCount: { decrement: 1 } },
		});
		if (!released.count)
			throw new AppError(409, "Section count changed; try again");
		const remaining = await tx.enrollment.findMany({
			where: { registrationId: registration.id, status: "ENROLLED" },
			select: { credits: true },
		});
		const totals = registrationTotals({
			credits: remaining.map((row) => row.credits),
			perCreditFee: student.program.perCreditFee,
			semesterFee: student.program.semesterFee,
			paidAmount: registration.paidAmount,
			minPaymentPercent: semester.minPaymentPercent,
		});
		const updatedRegistration = await tx.semesterRegistration.update({
			where: { id: registration.id },
			data: totals,
		});
		const seat = await tx.section.findUniqueOrThrow({
			where: { id: sectionId },
			select: { enrolledCount: true, capacity: true },
		});
		if (manual)
			await createAuditLogIntoDB(tx, {
				actorId: manual.actorId,
				action: "MANUAL_UNENROLL",
				entity: "Enrollment",
				entityId: enrollment.id,
				reason: manual.reason,
				before: {
					enrolledCount: seat.enrolledCount + 1,
					totalCredits: registration.totalCredits.toString(),
					totalFee: registration.totalFee.toString(),
				},
				after: {
					status: "DROPPED",
					enrolledCount: seat.enrolledCount,
					totalCredits: updatedRegistration.totalCredits.toString(),
					totalFee: updatedRegistration.totalFee.toString(),
				},
			});
		return {
			data: { enrollment: dropped, registration: updatedRegistration },
			seat,
		};
	}, registrationTransactionOptions);
	await publishSeatEvent(semester.id, { sectionId, ...result.seat });
	return result.data;
};

const switchSectionIntoDB = async (
	userId: string,
	fromSectionId: string,
	toSectionId: string,
) => {
	await checkRegistrationRateLimitFromDB(userId);
	const { student, semester } = await getStudentContextFromDB(userId);
	if (semester.phase !== "REGISTRATION")
		throw new AppError(
			409,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	await getOpenWindowFromDB(student.id, student.batchId, semester.id);
	const result = await prisma.$transaction(async (tx) => {
		const registration = await lockRegistrationIntoDB(
			tx,
			student.id,
			semester.id,
		);
		const enrollment = await tx.enrollment.findFirst({
			where: {
				studentId: student.id,
				sectionId: fromSectionId,
				semesterId: semester.id,
				status: "ENROLLED",
			},
		});
		const sections = await tx.section.findMany({
			where: {
				id: { in: [fromSectionId, toSectionId] },
				offering: { semesterId: semester.id },
			},
			include: scheduleInclude,
		});
		const from = sections.find((row) => row.id === fromSectionId);
		const to = sections.find((row) => row.id === toSectionId);
		if (
			!enrollment ||
			!from ||
			!to ||
			from.offeringId !== to.offeringId ||
			!to.timeSlot ||
			!to.dayPattern
		)
			throw new AppError(
				404,
				"Enrolled source and scheduled target must belong to the same course offering",
			);
		if (to.status !== "OPEN")
			throw new AppError(409, "This section is closed", {
				code: "SECTION_CLOSED",
			});
		const otherEnrollments = await tx.enrollment.findMany({
			where: {
				studentId: student.id,
				semesterId: semester.id,
				status: "ENROLLED",
				sectionId: { not: fromSectionId },
			},
			include: { section: { include: scheduleInclude } },
		});
		const targetDays = to.dayPattern.days;
		const targetTime = to.timeSlot;
		const conflict = otherEnrollments.find(
			(row) =>
				row.section.dayPattern?.days.some((day) => targetDays.includes(day)) &&
				row.section.timeSlot &&
				overlaps(targetTime, row.section.timeSlot),
		);
		if (conflict)
			throw new AppError(
				409,
				`Clashes with ${conflict.section.offering.course.code} section ${conflict.section.sectionNo}`,
				{
					code: "TIME_CLASH",
					sectionId: conflict.sectionId,
					courseCode: conflict.section.offering.course.code,
				},
			);
		// Every switch takes section locks in the same order, even for opposite moves.
		for (const id of [fromSectionId, toSectionId].sort()) {
			if (id === toSectionId) {
				const taken = await tx.section.updateMany({
					where: {
						id,
						status: "OPEN",
						enrolledCount: { lt: tx.section.fields.capacity },
					},
					data: { enrolledCount: { increment: 1 } },
				});
				if (!taken.count) {
					const alternatives = await tx.section.findMany({
						where: {
							offeringId: to.offeringId,
							id: { not: toSectionId },
							status: "OPEN",
							enrolledCount: { lt: tx.section.fields.capacity },
						},
						select: {
							id: true,
							sectionNo: true,
							enrolledCount: true,
							capacity: true,
						},
						orderBy: { sectionNo: "asc" },
					});
					throw new AppError(409, "This section has reached full capacity", {
						code: "SECTION_FULL",
						alternatives,
					});
				}
			} else {
				const released = await tx.section.updateMany({
					where: { id, enrolledCount: { gt: 0 } },
					data: { enrolledCount: { decrement: 1 } },
				});
				if (!released.count)
					throw new AppError(409, "Section count changed; try again");
			}
		}
		const dropped = await tx.enrollment.update({
			where: { id: enrollment.id },
			data: { status: "DROPPED", droppedAt: new Date() },
		});
		const selected = await tx.enrollment.upsert({
			where: {
				unique_student_section: {
					studentId: student.id,
					sectionId: toSectionId,
				},
			},
			create: {
				studentId: student.id,
				semesterId: semester.id,
				registrationId: registration.id,
				sectionId: toSectionId,
				offeringId: to.offeringId,
				credits: enrollment.credits,
			},
			update: {
				status: "ENROLLED",
				enrolledAt: new Date(),
				droppedAt: null,
				credits: enrollment.credits,
				grade: null,
				gradeSubmittedAt: null,
			},
		});
		const seats = await tx.section.findMany({
			where: { id: { in: [fromSectionId, toSectionId] } },
			select: { id: true, enrolledCount: true, capacity: true },
		});
		return {
			data: { fromEnrollment: dropped, enrollment: selected, registration },
			seats,
		};
	}, registrationTransactionOptions);
	await Promise.all(
		result.seats.map((seat) =>
			publishSeatEvent(semester.id, {
				sectionId: seat.id,
				enrolledCount: seat.enrolledCount,
				capacity: seat.capacity,
			}),
		),
	);
	return result.data;
};

const selectSectionWithGuardsIntoDB = async (
	userId: string,
	sectionId: string,
	idempotencyKey?: string,
): Promise<{ statusCode: number; data: unknown }> => {
	// Count retries too: the specified rate limit precedes idempotency lookup.
	await checkRegistrationRateLimitFromDB(userId);
	if (!idempotencyKey) return selectSectionIntoDB(userId, sectionId);
	const cacheKey = redisKey(`idempotency:${userId}:${idempotencyKey}`);
	const lockKey = redisKey(`idempotency-lock:${userId}:${idempotencyKey}`);
	const owner = randomUUID();
	const waitUntil = Date.now() + 180000;
	for (;;) {
		const cached = await redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached);
		const claimed = Number(
			await redisClient.eval(
				"if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', 180000) then return 1 end; return 0",
				{ keys: [lockKey], arguments: [owner] },
			),
		);
		if (claimed) break;
		if (Date.now() >= waitUntil)
			throw new AppError(
				409,
				"A request with this idempotency key is still in progress",
			);
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	try {
		// Another owner may have finished between our cache lookup and lock acquisition.
		const cached = await redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached);
		const result = await selectSectionIntoDB(userId, sectionId);
		await redisClient.set(cacheKey, JSON.stringify(result), {
			expiration: { type: "EX", value: 600 },
		});
		return result;
	} finally {
		await redisClient.eval(
			"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end; return 0",
			{ keys: [lockKey], arguments: [owner] },
		);
	}
};

const registrationSectionInclude = {
	...scheduleInclude,
	room: true,
	faculty: { select: { id: true, name: true, designation: true } },
} satisfies Prisma.SectionInclude;

const getMyRegistrationFromDB = async (userId: string) => {
	const { student, semester } = await getStudentContextFromDB(userId);
	const [window, registration, enrolled] = await Promise.all([
		prisma.registrationWindow.findUnique({
			where: {
				unique_batch_window: {
					batchId: student.batchId,
					semesterId: semester.id,
				},
			},
		}),
		prisma.semesterRegistration.findUnique({
			where: {
				unique_student_semester: {
					studentId: student.id,
					semesterId: semester.id,
				},
			},
		}),
		prisma.enrollment.findMany({
			where: {
				studentId: student.id,
				semesterId: semester.id,
				status: "ENROLLED",
			},
			include: { section: { include: registrationSectionInclude } },
			orderBy: { enrolledAt: "asc" },
		}),
	]);
	const now = new Date();
	return {
		semester,
		serverTime: now,
		window: window
			? {
					id: window.id,
					isOpen:
						semester.phase === "REGISTRATION" &&
						now >= window.startsAt &&
						now <= window.endsAt,
					opensAt: window.startsAt,
					closesAt: window.endsAt,
					serverTime: now,
				}
			: null,
		registration: registration
			? {
					...registration,
					maxCredits: semester.maxCredits,
					minimumPayment: registration.totalFee
						.mul(semester.minPaymentPercent)
						.div(100)
						.ceil(),
				}
			: null,
		sections: enrolled.map((row) => ({
			...row.section,
			enrollmentId: row.id,
			credits: row.credits,
		})),
	};
};

const catalogInclude = {
	course: {
		include: {
			prerequisites: {
				include: { prerequisite: { select: { id: true, code: true } } },
			},
		},
	},
	sections: {
		select: {
			id: true,
			sectionNo: true,
			facultyId: true,
			faculty: { select: { id: true, name: true, designation: true } },
			room: true,
			timeSlot: true,
			dayPattern: true,
		},
		orderBy: { sectionNo: "asc" },
	},
} satisfies Prisma.CourseOfferingInclude;
type TCatalogOffering = Prisma.CourseOfferingGetPayload<{
	include: typeof catalogInclude;
}>;

async function cachedCatalogFromDB(
	semesterId: string,
): Promise<TCatalogOffering[]> {
	const key = redisKey(`catalog:${semesterId}`);
	const cached = await redisClient.get(key);
	if (cached) {
		try {
			return JSON.parse(cached);
		} catch {
			await redisClient.del(key);
		}
	}
	// Capacity, counters and mutable status never enter this metadata cache.
	const rows = await prisma.courseOffering.findMany({
		where: { semesterId },
		include: catalogInclude,
	});
	await redisClient.set(key, JSON.stringify(rows), {
		expiration: { type: "EX", value: 30 },
	});
	return rows;
}

const getRegistrationOfferingsFromDB = async (
	userId: string,
	query: IRegistrationCatalogQuery,
) => {
	const { student, semester } = await getStudentContextFromDB(userId);
	const [catalog, live, enrolled, results] = await Promise.all([
		cachedCatalogFromDB(semester.id),
		prisma.section.findMany({
			where: { offering: { semesterId: semester.id } },
			select: { id: true, capacity: true, enrolledCount: true, status: true },
		}),
		prisma.enrollment.findMany({
			where: {
				studentId: student.id,
				semesterId: semester.id,
				status: "ENROLLED",
			},
			include: { section: { include: scheduleInclude } },
		}),
		prisma.courseResult.findMany({
			where: { studentId: student.id },
			select: { courseId: true, gradePoint: true },
		}),
	]);
	const liveById = new Map(live.map((row) => [row.id, row]));
	const heldOfferings = new Set(enrolled.map((row) => row.offeringId));
	const search = query.searchTerm?.toLowerCase();
	const filtered = catalog.filter(
		(row) =>
			!search ||
			row.course.code.toLowerCase().includes(search) ||
			row.course.title.toLowerCase().includes(search),
	);
	filtered.sort((a, b) => {
		const order =
			query.sortBy === "createdAt"
				? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				: a.course[query.sortBy].localeCompare(b.course[query.sortBy]);
		return (
			(query.sortOrder === "asc" ? order : -order) || a.id.localeCompare(b.id)
		);
	});
	const data = filtered
		.slice((query.page - 1) * query.limit, query.page * query.limit)
		.map((offering) => {
			const prerequisiteMissing = offering.course.prerequisites.some(
				(prerequisite) => {
					const minimum = getGradePoint(prerequisite.minGrade);
					return (
						!minimum ||
						!results.some(
							(result) =>
								result.courseId === prerequisite.prerequisiteId &&
								new Prisma.Decimal(result.gradePoint).gte(minimum),
						)
					);
				},
			);
			return {
				...offering,
				sections: offering.sections.flatMap((section) => {
					const seats = liveById.get(section.id);
					if (!seats || seats.status === "CANCELLED") return [];
					const days = section.dayPattern?.days ?? [];
					const slot = section.timeSlot;
					const clash =
						!!slot &&
						enrolled.some(
							(row) =>
								row.sectionId !== section.id &&
								row.section.timeSlot &&
								row.section.dayPattern?.days.some((day) =>
									days.includes(day),
								) &&
								overlaps(slot, row.section.timeSlot),
						);
					return [
						{
							...section,
							capacity: seats.capacity,
							enrolledCount: seats.enrolledCount,
							status: seats.status,
							seatsLeft: Math.max(0, seats.capacity - seats.enrolledCount),
							clash,
							hasCourse: heldOfferings.has(offering.id),
							prerequisiteMissing,
							full: seats.enrolledCount >= seats.capacity,
						},
					];
				}),
			};
		});
	return {
		data,
		meta: {
			page: query.page,
			limit: query.limit,
			total: filtered.length,
			totalPages: Math.ceil(filtered.length / query.limit),
		},
	};
};

const studentSelect = {
	id: true,
	universityId: true,
	name: true,
	email: true,
	batchId: true,
	programId: true,
	batch: { select: { id: true, code: true } },
	program: { select: { id: true, code: true, name: true } },
} satisfies Prisma.StudentSelect;

const getAllRegistrationsFromDB = async (query: IAdminRegistrationQuery) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: query.semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(404, "Semester not found");
	const where: Prisma.SemesterRegistrationWhereInput = {
		semesterId: query.semesterId,
		...(query.status ? { status: query.status } : {}),
		...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
		student: {
			...(query.batchId ? { batchId: query.batchId } : {}),
			...(query.searchTerm
				? {
						OR: [
							{
								universityId: {
									contains: query.searchTerm,
									mode: "insensitive",
								},
							},
							{ name: { contains: query.searchTerm, mode: "insensitive" } },
							{ email: { contains: query.searchTerm, mode: "insensitive" } },
						],
					}
				: {}),
		},
		...(query.atRisk
			? {
					AND: [
						{
							status: "ACTIVE",
							paymentStatus: "UNPAID",
							paymentDeadline: { lte: new Date(Date.now() + 3 * 86400000) },
						},
					],
				}
			: {}),
	};
	const [data, total] = await Promise.all([
		prisma.semesterRegistration.findMany({
			where,
			include: {
				student: { select: studentSelect },
				_count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
			},
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
		}),
		prisma.semesterRegistration.count({ where }),
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

const getStudentRegistrationFromDB = async (
	studentId: string,
	semesterId: string,
) => {
	const registration = await prisma.semesterRegistration.findUnique({
		where: { unique_student_semester: { studentId, semesterId } },
		include: {
			student: { select: studentSelect },
			semester: true,
			enrollments: {
				include: { section: { include: registrationSectionInclude } },
				orderBy: { enrolledAt: "desc" },
			},
			payments: { orderBy: { createdAt: "desc" } },
		},
	});
	if (!registration) throw new AppError(404, "Semester registration not found");
	return registration;
};

async function activeStudentUserIdFromDB(studentId: string) {
	const student = await prisma.student.findFirst({
		where: {
			id: studentId,
			isDeleted: false,
			user: { status: "ACTIVE", isDeleted: false },
		},
		select: { userId: true },
	});
	if (!student) throw new AppError(404, "Active student not found");
	return student.userId;
}

const manuallySelectSectionIntoDB = async (
	actorId: string,
	studentId: string,
	sectionId: string,
	payload: IManualRegistration,
) =>
	selectSectionIntoDB(await activeStudentUserIdFromDB(studentId), sectionId, {
		...payload,
		actorId,
	});
const manuallyUnselectSectionIntoDB = async (
	actorId: string,
	studentId: string,
	sectionId: string,
	reason: string,
) =>
	unselectSectionIntoDB(await activeStudentUserIdFromDB(studentId), sectionId, {
		actorId,
		reason,
	});

export const registrationService = {
	getAllRegistrationsFromDB,
	getStudentRegistrationFromDB,
	manuallySelectSectionIntoDB,
	manuallyUnselectSectionIntoDB,
	getSeatStreamSemesterFromDB: async () => {
		const semester = await prisma.semester.findFirst({
			where: { phase: { not: "CLOSED" } },
			select: { id: true },
		});
		if (!semester) throw new AppError(404, "No current semester");
		return semester;
	},
	getMyRegistrationFromDB,
	getRegistrationOfferingsFromDB,
	selectSectionWithGuardsIntoDB,
	selectSectionIntoDB,
	unselectSectionIntoDB,
	switchSectionIntoDB,
};
