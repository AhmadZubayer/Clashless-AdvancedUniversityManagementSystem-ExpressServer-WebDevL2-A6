import { Prisma } from "../../../generated/prisma/client";
import { randomUUID } from "node:crypto";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { redisClient, redisKey } from "../../lib/redis";
import { publishSeatEvent } from "../../lib/seatEvents";
import { AppError } from "../../utils/AppError";
import { getGradePoint } from "../../utils/grade";
import { registrationTotals } from "../../utils/registrationTotals";
import { formatDhaka, overlaps } from "../../utils/time";

// Raw writes must use the same schema as Prisma's driver adapter.
function table(name: "semester_registrations") {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.database_schema))
		throw new Error("Unsupported database schema identifier");
	return Prisma.raw(`"${config.database_schema}"."${name}"`);
}

async function getStudentContextFromDB(userId: string) {
	const student = await prisma.student.findUnique({
		where: { userId },
		include: { program: true },
	});
	if (!student || student.isDeleted)
		throw new AppError(404, "Student profile not found");
	const semester = await prisma.semester.findFirst({
		where: { phase: { not: "CLOSED" } },
	});
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
	const rows = await tx.$queryRaw<{ id: string }[]>(
		Prisma.sql`SELECT id FROM ${registrationsTable} WHERE "studentId" = ${studentId} AND "semesterId" = ${semesterId} FOR UPDATE`,
	);
	if (!rows[0]) throw new AppError(404, "Semester registration not found");
	const registration = await tx.semesterRegistration.findUniqueOrThrow({
		where: { id: rows[0].id },
	});
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

const selectSectionIntoDB = async (userId: string, sectionId: string) => {
	const { student, semester } = await getStudentContextFromDB(userId);
	if (semester.phase !== "REGISTRATION")
		throw new AppError(
			409,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	const window = await getOpenWindowFromDB(
		student.id,
		student.batchId,
		semester.id,
	);
	const paymentDeadline = new Date(
		window.endsAt.getTime() + semester.paymentDeadlineDays * 86400000,
	);
	const result = await prisma.$transaction(
		async (tx) => {
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
					row.section.dayPattern?.days.some((day) =>
						sectionDays.includes(day),
					) &&
					overlaps(sectionTime, row.section.timeSlot),
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
			if (
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
			if (prerequisites.length) {
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
			return {
				statusCode: 201,
				data: { enrollment, registration: updatedRegistration },
				seat,
			};
		},
		{ maxWait: 60000, timeout: 60000 },
	);
	if (result.seat)
		await publishSeatEvent(semester.id, {
			sectionId,
			enrolledCount: result.seat.enrolledCount,
			capacity: result.seat.capacity,
		});
	return { statusCode: result.statusCode, data: result.data };
};

const unselectSectionIntoDB = async (userId: string, sectionId: string) => {
	await checkRegistrationRateLimitFromDB(userId);
	const { student, semester } = await getStudentContextFromDB(userId);
	if (semester.phase !== "REGISTRATION")
		throw new AppError(
			409,
			`Not allowed while the semester is in ${semester.phase}`,
			{ code: "PHASE_NOT_ALLOWED" },
		);
	await getOpenWindowFromDB(student.id, student.batchId, semester.id);
	const result = await prisma.$transaction(
		async (tx) => {
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
			return {
				data: { enrollment: dropped, registration: updatedRegistration },
				seat,
			};
		},
		{ maxWait: 60000, timeout: 60000 },
	);
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
	const result = await prisma.$transaction(
		async (tx) => {
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
					row.section.dayPattern?.days.some((day) =>
						targetDays.includes(day),
					) &&
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
		},
		{ maxWait: 60000, timeout: 60000 },
	);
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

export const registrationService = {
	selectSectionWithGuardsIntoDB,
	selectSectionIntoDB,
	unselectSectionIntoDB,
	switchSectionIntoDB,
};
