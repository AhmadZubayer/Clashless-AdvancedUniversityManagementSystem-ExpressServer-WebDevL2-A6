import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const DAY = 86400000;
const WEEKDAY: Record<string, number> = {
	SUN: 0,
	MON: 1,
	TUE: 2,
	WED: 3,
	THU: 4,
	FRI: 5,
	SAT: 6,
};

async function resolveSemester(semesterId?: string) {
	const semester = await prisma.semester.findFirst({
		where: semesterId ? { id: semesterId } : { phase: { not: "CLOSED" } },
		orderBy: { createdAt: "desc" },
	});
	if (!semester)
		throw new AppError(
			404,
			semesterId ? "Semester not found" : "No current semester",
		);
	return semester;
}

const getAdminAnalyticsFromDB = async (semesterId?: string) => {
	const semester = await resolveSemester(semesterId);
	const now = new Date();
	const [
		batches,
		students,
		registrations,
		sections,
		offerings,
		routine,
		slots,
	] = await Promise.all([
		prisma.batch.findMany({ select: { id: true, code: true } }),
		prisma.student.groupBy({
			by: ["batchId"],
			where: { isDeleted: false },
			_count: { _all: true },
		}),
		prisma.semesterRegistration.findMany({
			where: { semesterId: semester.id },
			select: {
				status: true,
				paymentStatus: true,
				totalFee: true,
				totalCredits: true,
				paidAmount: true,
				paymentDeadline: true,
				student: { select: { batchId: true } },
			},
		}),
		prisma.section.findMany({
			where: {
				offering: { semesterId: semester.id },
				status: { not: "CANCELLED" },
			},
			select: { offeringId: true, enrolledCount: true, capacity: true },
		}),
		prisma.courseOffering.count({ where: { semesterId: semester.id } }),
		prisma.routine.findFirst({
			where: { semesterId: semester.id, status: "PUBLISHED" },
			include: {
				entries: {
					select: {
						roomId: true,
						room: { select: { code: true, type: true } },
						dayPattern: { select: { days: true } },
					},
				},
			},
		}),
		prisma.timeSlot.groupBy({ by: ["type"], _count: { _all: true } }),
	]);

	const totalByBatch = new Map(
		students.map((row) => [row.batchId, row._count._all]),
	);
	const registeredByBatch = new Map<string, number>();
	for (const row of registrations)
		if (row.status === "ACTIVE" && row.totalCredits.gt(0))
			registeredByBatch.set(
				row.student.batchId,
				(registeredByBatch.get(row.student.batchId) ?? 0) + 1,
			);

	const full = sections.filter((row) => row.enrolledCount >= row.capacity);
	const fill =
		sections.length === 0
			? 0
			: sections.reduce(
					(sum, row) => sum + row.enrolledCount / row.capacity,
					0,
				) / sections.length;
	const byOffering = new Map<string, { total: number; full: number }>();
	for (const row of sections) {
		const entry = byOffering.get(row.offeringId) ?? { total: 0, full: 0 };
		entry.total += 1;
		if (row.enrolledCount >= row.capacity) entry.full += 1;
		byOffering.set(row.offeringId, entry);
	}
	const coursesFullyBooked = [...byOffering.values()].filter(
		(row) => row.total > 0 && row.total === row.full,
	).length;

	const active = registrations.filter((row) => row.status === "ACTIVE");
	let billed = new Prisma.Decimal(0);
	let collected = new Prisma.Decimal(0);
	for (const row of active) billed = billed.plus(row.totalFee);
	for (const row of registrations) collected = collected.plus(row.paidAmount);
	const soon = new Date(now.getTime() + 3 * DAY);
	const slotCount = new Map(slots.map((row) => [row.type, row._count._all]));
	const rooms = new Map<
		string,
		{ code: string; used: number; capacity: number }
	>();
	for (const entry of routine?.entries ?? []) {
		const row = rooms.get(entry.roomId) ?? {
			code: entry.room.code,
			used: 0,
			capacity:
				(slotCount.get(entry.room.type === "LAB" ? "LAB" : "THEORY") ?? 0) * 5,
		};
		row.used += entry.dayPattern.days.length;
		rooms.set(entry.roomId, row);
	}
	const roomUse = [...rooms.values()].map((row) => ({
		room: row.code,
		usedSlots: row.used,
		capacity: row.capacity,
		percent: row.capacity
			? Math.round((row.used / row.capacity) * 1000) / 10
			: 0,
	}));

	return {
		semester: { id: semester.id, name: semester.name, phase: semester.phase },
		batches: batches.map((batch) => ({
			batchId: batch.id,
			code: batch.code,
			registered: registeredByBatch.get(batch.id) ?? 0,
			total: totalByBatch.get(batch.id) ?? 0,
		})),
		sections: {
			total: sections.length,
			full: full.length,
			averageFillPercent: Math.round(fill * 1000) / 10,
		},
		courses: { offered: offerings, fullyBooked: coursesFullyBooked },
		fees: { billed: billed.toString(), collected: collected.toString() },
		payments: {
			unpaid: active.filter((row) => row.paymentStatus === "UNPAID").length,
			minimumPaid: active.filter((row) => row.paymentStatus === "MINIMUM_PAID")
				.length,
			fullyPaid: active.filter((row) => row.paymentStatus === "FULLY_PAID")
				.length,
			atRisk: active.filter(
				(row) =>
					row.paymentStatus === "UNPAID" &&
					row.totalFee.gt(0) &&
					row.paymentDeadline <= soon,
			).length,
			discarded: registrations.filter((row) => row.status === "DISCARDED")
				.length,
		},
		roomUse: {
			rooms: roomUse,
			averagePercent: roomUse.length
				? Math.round(
						(roomUse.reduce((sum, row) => sum + row.percent, 0) /
							roomUse.length) *
							10,
					) / 10
				: 0,
		},
	};
};

const getRegistrationLiveFromDB = async () => {
	const semester = await resolveSemester();
	const now = Date.now();
	const [windows, recent, sections] = await Promise.all([
		prisma.registrationWindow.findMany({
			where: {
				semesterId: semester.id,
				startsAt: { lte: new Date(now) },
				endsAt: { gte: new Date(now) },
			},
			include: { batch: { select: { code: true } } },
		}),
		prisma.enrollment.findMany({
			where: {
				semesterId: semester.id,
				enrolledAt: { gte: new Date(now - 60 * 60000) },
			},
			select: {
				enrolledAt: true,
				sectionId: true,
				offeringId: true,
			},
		}),
		prisma.section.findMany({
			where: {
				offering: { semesterId: semester.id },
				status: { not: "CANCELLED" },
			},
			select: {
				id: true,
				sectionNo: true,
				capacity: true,
				enrolledCount: true,
				offeringId: true,
				offering: { select: { course: { select: { code: true } } } },
			},
		}),
	]);
	const perMinute = Array.from({ length: 30 }, (_, index) => {
		const start = new Date(now - (30 - index) * 60000);
		return { minute: start.toISOString().slice(0, 16), selections: 0 };
	});
	for (const row of recent) {
		const age = Math.floor((now - row.enrolledAt.getTime()) / 60000);
		if (age < 30) perMinute[29 - age].selections += 1;
	}
	const lastSelection = new Map<string, number>();
	for (const row of recent)
		lastSelection.set(
			row.sectionId,
			Math.max(lastSelection.get(row.sectionId) ?? 0, row.enrolledAt.getTime()),
		);
	const filledRecently = sections
		.filter(
			(row) => row.enrolledCount >= row.capacity && lastSelection.has(row.id),
		)
		.map((row) => ({
			sectionId: row.id,
			courseCode: row.offering.course.code,
			sectionNo: row.sectionNo,
			filledAt: new Date(lastSelection.get(row.id) as number),
		}));
	const perOffering = new Map<
		string,
		{ code: string; enrolled: number; capacity: number; recent: number }
	>();
	for (const row of sections) {
		const entry = perOffering.get(row.offeringId) ?? {
			code: row.offering.course.code,
			enrolled: 0,
			capacity: 0,
			recent: 0,
		};
		entry.enrolled += row.enrolledCount;
		entry.capacity += row.capacity;
		perOffering.set(row.offeringId, entry);
	}
	for (const row of recent) {
		const entry = perOffering.get(row.offeringId);
		if (entry) entry.recent += 1;
	}
	const fastest = [...perOffering.values()]
		.filter((row) => row.recent > 0)
		.sort(
			(a, b) =>
				b.recent / (b.capacity || 1) - a.recent / (a.capacity || 1) ||
				b.recent - a.recent,
		)
		.slice(0, 10)
		.map((row) => ({
			courseCode: row.code,
			enrolled: row.enrolled,
			capacity: row.capacity,
			selectionsLastHour: row.recent,
		}));
	return {
		semester: { id: semester.id, phase: semester.phase },
		openWindows: windows.map((row) => ({
			id: row.id,
			batch: row.batch.code,
			startsAt: row.startsAt,
			endsAt: row.endsAt,
		})),
		selectionsPerMinute: perMinute,
		sectionsFilledLastHour: filledRecently,
		fastestFillingCourses: fastest,
	};
};

// Minutes until a weekly meeting next starts, in Asia/Dhaka (UTC+6, no DST).
function minutesUntil(days: string[], startMinute: number, nowMs = Date.now()) {
	const dhaka = new Date(nowMs + 6 * 3600000);
	const today = dhaka.getUTCDay();
	const minutes = dhaka.getUTCHours() * 60 + dhaka.getUTCMinutes();
	let best = Number.POSITIVE_INFINITY;
	for (const day of days) {
		let diff = (WEEKDAY[day] - today + 7) % 7;
		if (diff === 0 && startMinute <= minutes) diff = 7;
		best = Math.min(best, diff * 1440 + startMinute - minutes);
	}
	return best;
}

const getMyAnalyticsFromDB = async (actor: RequestUser) => {
	const semester = await resolveSemester();
	if (actor.role === "FACULTY") {
		const teacher = await prisma.faculty.findUnique({
			where: { userId: actor.id },
			select: { id: true, maxCreditLoad: true },
		});
		if (!teacher) throw new AppError(404, "Faculty profile not found");
		const [sections, duties] = await Promise.all([
			prisma.section.findMany({
				where: {
					facultyId: teacher.id,
					offering: { semesterId: semester.id },
					status: { not: "CANCELLED" },
				},
				select: {
					id: true,
					sectionNo: true,
					enrolledCount: true,
					capacity: true,
					offering: {
						select: { course: { select: { code: true, credits: true } } },
					},
					enrollments: {
						where: { status: "ENROLLED" },
						select: { grade: true },
					},
				},
			}),
			prisma.invigilatorAssignment.findMany({
				where: {
					facultyId: teacher.id,
					seatPlan: { semesterId: semester.id },
				},
				select: {
					room: { select: { roomNo: true } },
					seatPlan: {
						select: {
							status: true,
							examSlot: { select: { date: true, startMinute: true } },
						},
					},
				},
			}),
		]);
		const credits = sections.reduce(
			(sum, row) => sum.plus(row.offering.course.credits),
			new Prisma.Decimal(0),
		);
		return {
			role: "FACULTY",
			semesterId: semester.id,
			teachingCredits: credits.toString(),
			maxCreditLoad: teacher.maxCreditLoad.toString(),
			classSizes: sections.map((row) => ({
				sectionId: row.id,
				courseCode: row.offering.course.code,
				sectionNo: row.sectionNo,
				enrolled: row.enrolledCount,
				capacity: row.capacity,
			})),
			invigilationDuties: duties.map((row) => ({
				roomNo: row.room.roomNo,
				status: row.seatPlan.status,
				date: row.seatPlan.examSlot.date,
				startMinute: row.seatPlan.examSlot.startMinute,
			})),
			gradeSubmission: sections.map((row) => ({
				sectionId: row.id,
				courseCode: row.offering.course.code,
				enrolled: row.enrollments.length,
				submitted: row.enrollments.filter((item) => item.grade).length,
			})),
		};
	}
	const student = await prisma.student.findUnique({
		where: { userId: actor.id },
		select: { id: true, cgpa: true, earnedCredits: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	const [registration, enrollments] = await Promise.all([
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
			select: {
				section: {
					select: {
						offering: {
							select: {
								course: { select: { code: true } },
								examSlot: {
									select: { date: true, startMinute: true, endMinute: true },
								},
							},
						},
						routineEntries: {
							where: { routine: { status: "PUBLISHED" } },
							select: {
								dayPattern: { select: { days: true } },
								timeSlot: { select: { startMinute: true, endMinute: true } },
								room: { select: { code: true } },
							},
						},
					},
				},
			},
		}),
	]);
	let nextClass: {
		courseCode: string;
		roomCode: string;
		minutesUntil: number;
		startMinute: number;
		days: string[];
	} | null = null;
	let nextExam: { courseCode: string; date: Date; startMinute: number } | null =
		null;
	const today = new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
	for (const row of enrollments) {
		for (const entry of row.section.routineEntries) {
			const wait = minutesUntil(
				entry.dayPattern.days,
				entry.timeSlot.startMinute,
			);
			if (!nextClass || wait < nextClass.minutesUntil)
				nextClass = {
					courseCode: row.section.offering.course.code,
					roomCode: entry.room.code,
					minutesUntil: wait,
					startMinute: entry.timeSlot.startMinute,
					days: entry.dayPattern.days,
				};
		}
		const slot = row.section.offering.examSlot;
		if (
			slot &&
			slot.date.toISOString().slice(0, 10) >= today &&
			(!nextExam ||
				slot.date < nextExam.date ||
				(slot.date.getTime() === nextExam.date.getTime() &&
					slot.startMinute < nextExam.startMinute))
		)
			nextExam = {
				courseCode: row.section.offering.course.code,
				date: slot.date,
				startMinute: slot.startMinute,
			};
	}
	const due = registration
		? Prisma.Decimal.max(
				registration.totalFee.minus(registration.paidAmount),
				new Prisma.Decimal(0),
			)
		: new Prisma.Decimal(0);
	return {
		role: "STUDENT",
		semesterId: semester.id,
		credits: registration?.totalCredits.toString() ?? "0",
		cgpa: student.cgpa.toString(),
		earnedCredits: student.earnedCredits.toString(),
		feeDue: due.toString(),
		paymentDeadline: registration?.paymentDeadline ?? null,
		paymentStatus: registration?.paymentStatus ?? null,
		nextClass,
		nextExam,
	};
};

export const analyticsService = {
	getAdminAnalyticsFromDB,
	getRegistrationLiveFromDB,
	getMyAnalyticsFromDB,
};
