import { Prisma } from "../../../generated/prisma/client";
import {
	NotEnoughSeatsError,
	generateSeatPlan,
} from "../../engine/seatPlanGenerator";
import type { ISeatOffering } from "../../engine/seatPlanGenerator";
import {
	columnSize,
	columnsOf,
	seatKey,
	touchesSameCourse,
	validateSeatPlan,
} from "../../engine/seatPlanValidator";
import type { ISeatRoom } from "../../engine/seatPlanValidator";
import { queueEmail } from "../../jobs/email";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { generatePdf } from "../../utils/generatePdf";
import { minutesToTime } from "../../utils/time";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import { createNotificationsIntoDB } from "../notification/notification.service";
import type { IRoomInput } from "./seatPlan.interface";

const txOptions = {
	isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
	timeout: 30000,
};
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

type Db = Prisma.TransactionClient;

async function loadPlan(db: Db, id: string) {
	const plan = await db.seatPlan.findUnique({
		where: { id },
		include: {
			examSlot: true,
			rooms: { orderBy: { fillOrder: "asc" } },
		},
	});
	if (!plan) throw new AppError(404, "Seat plan not found");
	return plan;
}

async function loadDraftPlan(db: Db, id: string) {
	const plan = await loadPlan(db, id);
	if (plan.status !== "DRAFT")
		throw new AppError(409, "Only draft seat plans may be changed");
	return plan;
}

// The offerings of one exam slot with their ENROLLED students.
async function loadSlotOfferings(db: Db, examSlotId: string) {
	const rows = await db.courseOffering.findMany({
		where: { examSlotId },
		select: {
			id: true,
			course: { select: { code: true } },
			enrollments: {
				where: { status: "ENROLLED" },
				select: {
					student: {
						select: { id: true, universityId: true, name: true, email: true },
					},
				},
			},
		},
	});
	return rows.map((row) => ({
		id: row.id,
		code: row.course.code,
		students: row.enrollments.map((item) => item.student),
	}));
}

const toRooms = (
	rooms: { roomNo: string; totalSeats: number; seatsPerColumn: number }[],
): ISeatRoom[] =>
	rooms.map(({ roomNo, totalSeats, seatsPerColumn }) => ({
		roomNo,
		totalSeats,
		seatsPerColumn,
	}));

const createSeatPlanIntoDB = async (examSlotId: string) =>
	prisma.$transaction(async (tx) => {
		const slot = await tx.examSlot.findUnique({ where: { id: examSlotId } });
		if (!slot) throw new AppError(404, "Exam slot not found");
		const published = await tx.examRoutine.findFirst({
			where: { semesterId: slot.semesterId, status: "PUBLISHED" },
			select: { id: true },
		});
		if (!published)
			throw new AppError(409, "Publish the exam routine first", {
				code: "PHASE_NOT_ALLOWED",
			});
		if (!(await tx.courseOffering.count({ where: { examSlotId } })))
			throw new AppError(409, "This slot has no courses");
		if (await tx.seatPlan.findUnique({ where: { examSlotId } }))
			throw new AppError(409, "This slot already has a seat plan");
		return tx.seatPlan.create({
			data: { examSlotId, semesterId: slot.semesterId },
		});
	}, txOptions);

const getSeatPlansOverviewFromDB = async (semesterId: string) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(404, "Semester not found");
	const slots = await prisma.examSlot.findMany({
		where: { semesterId },
		orderBy: [{ date: "asc" }, { startMinute: "asc" }],
		include: {
			seatPlan: { select: { id: true, status: true, generatedAt: true } },
			_count: { select: { offerings: true } },
		},
	});
	return slots.map(({ seatPlan, _count, ...slot }) => ({
		...slot,
		courseCount: _count.offerings,
		seatPlan,
		seatPlanStatus: seatPlan?.status ?? "NONE",
	}));
};

const getLastUsedRoomsFromDB = async () => {
	const plan = await prisma.seatPlan.findFirst({
		where: { generatedAt: { not: null } },
		orderBy: { generatedAt: "desc" },
		include: { rooms: { orderBy: { fillOrder: "asc" } } },
	});
	return (plan?.rooms ?? []).map(({ roomNo, totalSeats, seatsPerColumn }) => ({
		roomNo,
		totalSeats,
		seatsPerColumn,
	}));
};

const roomCapacities = (room: ISeatRoom) => {
	let odd = 0;
	let even = 0;
	for (let column = 1; column <= columnsOf(room); column++)
		if (column % 2) odd += columnSize(room, column);
		else even += columnSize(room, column);
	return { oddSeats: odd, evenSeats: even };
};

const setRoomsIntoDB = (id: string, rooms: IRoomInput[]) =>
	prisma.$transaction(async (tx) => {
		const plan = await loadDraftPlan(tx, id);
		await tx.seatAssignment.deleteMany({ where: { seatPlanId: id } });
		await tx.seatPlanRoom.deleteMany({ where: { seatPlanId: id } });
		await tx.seatPlanRoom.createMany({
			data: rooms.map((room, index) => ({
				seatPlanId: id,
				roomNo: room.roomNo,
				totalSeats: room.totalSeats,
				seatsPerColumn: room.seatsPerColumn,
				columns: Math.ceil(room.totalSeats / room.seatsPerColumn),
				fillOrder: index + 1,
			})),
		});
		await tx.seatPlan.update({
			where: { id },
			data: { report: Prisma.JsonNull, generatedAt: null },
		});
		const offerings = await loadSlotOfferings(tx, plan.examSlotId);
		const students = offerings.reduce(
			(sum, row) => sum + row.students.length,
			0,
		);
		const detail = rooms.map((room) => ({
			...room,
			columns: Math.ceil(room.totalSeats / room.seatsPerColumn),
			...roomCapacities(room),
		}));
		return {
			rooms: detail,
			totalSeats: rooms.reduce((sum, room) => sum + room.totalSeats, 0),
			oddSeats: detail.reduce((sum, room) => sum + room.oddSeats, 0),
			evenSeats: detail.reduce((sum, room) => sum + room.evenSeats, 0),
			students,
		};
	}, txOptions);

const generateSeatPlanIntoDB = async (
	id: string,
	orderBy: "STUDENT_ID" | "NAME",
) => {
	const plan = await loadDraftPlan(prisma, id);
	if (!plan.rooms.length)
		throw new AppError(409, "Enter at least one room first");
	const offerings = await loadSlotOfferings(prisma, plan.examSlotId);
	const rooms = toRooms(plan.rooms);
	let result: ReturnType<typeof generateSeatPlan>;
	try {
		result = generateSeatPlan({
			offerings: offerings.map(
				(row): ISeatOffering => ({
					id: row.id,
					code: row.code,
					students: row.students,
				}),
			),
			rooms,
			orderBy,
		});
	} catch (error) {
		if (error instanceof NotEnoughSeatsError)
			throw new AppError(409, error.message, {
				code: "NOT_ENOUGH_SEATS",
				...error.details,
			});
		throw error;
	}
	const roomId = new Map(plan.rooms.map((room) => [room.roomNo, room.id]));
	await prisma.$transaction(async (tx) => {
		await loadDraftPlan(tx, id);
		await tx.seatAssignment.deleteMany({ where: { seatPlanId: id } });
		await tx.seatAssignment.createMany({
			data: result.seats.map((seat) => ({
				seatPlanId: id,
				seatPlanRoomId: roomId.get(seat.roomNo) as string,
				column: seat.column,
				seatNo: seat.seatNo,
				label: `${seat.roomNo}-C${seat.column}-S${seat.seatNo}`,
				studentId: seat.studentId,
				offeringId: seat.offeringId,
			})),
		});
		await tx.seatPlan.update({
			where: { id },
			data: {
				orderBy,
				report: result.report as unknown as Prisma.InputJsonValue,
				generatedAt: new Date(),
			},
		});
	}, txOptions);
	return {
		report: result.report,
		validation: validateSeatPlan({
			students: offerings.flatMap((row) =>
				row.students.map((student) => ({
					studentId: student.id,
					offeringId: row.id,
				})),
			),
			rooms,
			seats: result.seats,
		}),
	};
};

async function loadSeats(db: Db, seatPlanId: string) {
	return db.seatAssignment.findMany({
		where: { seatPlanId },
		include: {
			room: { select: { roomNo: true } },
			student: { select: { universityId: true, name: true } },
			offering: { select: { course: { select: { code: true } } } },
		},
	});
}

const getSeatPlanSummaryFromDB = async (id: string) => {
	const plan = await loadPlan(prisma, id);
	const [seats, offerings] = await Promise.all([
		loadSeats(prisma, id),
		loadSlotOfferings(prisma, plan.examSlotId),
	]);
	const rooms = toRooms(plan.rooms);
	const groups = new Map<
		string,
		{
			roomNo: string;
			column: number;
			courses: Set<string>;
			ids: { seatNo: number; universityId: string }[];
		}
	>();
	for (const seat of seats) {
		const key = `${seat.room.roomNo}|${seat.column}`;
		const group = groups.get(key) ?? {
			roomNo: seat.room.roomNo,
			column: seat.column,
			courses: new Set<string>(),
			ids: [],
		};
		group.courses.add(seat.offering.course.code);
		group.ids.push({
			seatNo: seat.seatNo,
			universityId: seat.student.universityId,
		});
		groups.set(key, group);
	}
	const columns = [...groups.values()]
		.map((group) => {
			const ordered = [...group.ids].sort((a, b) => a.seatNo - b.seatNo);
			return {
				roomNo: group.roomNo,
				column: group.column,
				courses: [...group.courses],
				firstUniversityId: ordered[0].universityId,
				lastUniversityId: ordered[ordered.length - 1].universityId,
				count: ordered.length,
			};
		})
		.sort(
			(a, b) =>
				plan.rooms.findIndex((room) => room.roomNo === a.roomNo) -
					plan.rooms.findIndex((room) => room.roomNo === b.roomNo) ||
				a.column - b.column,
		);
	const seated = new Set(seats.map((seat) => seat.studentId));
	const unseated = offerings.flatMap((row) =>
		row.students
			.filter((student) => !seated.has(student.id))
			.map((student) => ({
				studentId: student.id,
				universityId: student.universityId,
				name: student.name,
				course: row.code,
			})),
	);
	const usedRooms = new Set(seats.map((seat) => seat.room.roomNo));
	const validation = validateSeatPlan({
		students: offerings.flatMap((row) =>
			row.students.map((student) => ({
				studentId: student.id,
				offeringId: row.id,
			})),
		),
		rooms,
		seats: seats.map((seat) => ({
			roomNo: seat.room.roomNo,
			column: seat.column,
			seatNo: seat.seatNo,
			studentId: seat.studentId,
			offeringId: seat.offeringId,
		})),
	});
	return {
		id: plan.id,
		status: plan.status,
		orderBy: plan.orderBy,
		examSlot: plan.examSlot,
		rooms: plan.rooms,
		seated: seats.length,
		columns,
		emptySeats:
			plan.rooms.reduce((sum, room) => sum + room.totalSeats, 0) - seats.length,
		unusedRooms: plan.rooms
			.filter((room) => !usedRooms.has(room.roomNo))
			.map((room) => room.roomNo),
		unseated,
		validation,
	};
};

const getRoomGridFromDB = async (
	id: string,
	roomId: string,
	actor: RequestUser,
) => {
	const plan = await loadPlan(prisma, id);
	const room = plan.rooms.find((row) => row.id === roomId);
	if (!room) throw new AppError(404, "Room not found in this seat plan");
	if (actor.role === "FACULTY") {
		const duty = await prisma.invigilatorAssignment.findFirst({
			where: {
				seatPlanId: id,
				seatPlanRoomId: roomId,
				faculty: { userId: actor.id },
			},
			select: { id: true },
		});
		if (!duty) throw new AppError(403, "You do not invigilate this room");
	}
	const seats = await prisma.seatAssignment.findMany({
		where: { seatPlanId: id, seatPlanRoomId: roomId },
		include: {
			student: { select: { universityId: true, name: true } },
			offering: { select: { course: { select: { code: true } } } },
		},
	});
	const columns = [];
	for (let column = 1; column <= columnsOf(room); column++)
		columns.push({
			column,
			seats: Array.from({ length: columnSize(room, column) }, (_, index) => {
				const seat = seats.find(
					(row) => row.column === column && row.seatNo === index + 1,
				);
				return {
					seatNo: index + 1,
					label: seat?.label ?? null,
					universityId: seat?.student.universityId ?? null,
					name: seat?.student.name ?? null,
					course: seat?.offering.course.code ?? null,
				};
			}),
		});
	return { room, columns };
};

async function emailSeat(
	studentIds: string[],
	seatPlanId: string,
	changed: boolean,
) {
	const seats = await prisma.seatAssignment.findMany({
		where: { seatPlanId, studentId: { in: studentIds } },
		include: {
			student: { select: { name: true, email: true } },
			room: { select: { roomNo: true } },
			seatPlan: { include: { examSlot: true } },
			offering: { select: { course: { select: { code: true } } } },
		},
	});
	for (const seat of seats) {
		try {
			const slot = seat.seatPlan.examSlot;
			await queueEmail({
				to: seat.student.email,
				subject: changed ? "Your exam seat changed" : "Your exam seat",
				templateName: "seat-plan-published",
				templateData: {
					name: seat.student.name,
					course: seat.offering.course.code,
					date: dateOnly(slot.date),
					time: `${minutesToTime(slot.startMinute)}-${minutesToTime(slot.endMinute)}`,
					roomNo: seat.room.roomNo,
					column: seat.column,
					seatNo: seat.seatNo,
					changed,
				},
			});
		} catch {
			// a failed email never blocks the change
		}
	}
}

const swapSeatsIntoDB = async (
	id: string,
	actorId: string,
	seatAId: string,
	seatBId: string,
) => {
	const result = await prisma.$transaction(async (tx) => {
		const plan = await loadPlan(tx, id);
		if (seatAId === seatBId)
			throw new AppError(400, "Pick two different seats");
		const [a, b] = await Promise.all([
			tx.seatAssignment.findFirst({ where: { id: seatAId, seatPlanId: id } }),
			tx.seatAssignment.findFirst({ where: { id: seatBId, seatPlanId: id } }),
		]);
		if (!a || !b) throw new AppError(404, "Seat not found in this seat plan");
		const roomIds = [...new Set([a.seatPlanRoomId, b.seatPlanRoomId])];
		const others = await tx.seatAssignment.findMany({
			where: {
				seatPlanId: id,
				seatPlanRoomId: { in: roomIds },
				id: { notIn: [a.id, b.id] },
			},
			select: {
				seatPlanRoomId: true,
				column: true,
				seatNo: true,
				offeringId: true,
			},
		});
		const byKey = new Map(
			others.map((row) => [
				seatKey(row.seatPlanRoomId, row.column, row.seatNo),
				row,
			]),
		);
		// after the swap: A's position holds B's student and the other way round
		const moved = [
			{ at: a, offeringId: b.offeringId },
			{ at: b, offeringId: a.offeringId },
		];
		for (const item of moved)
			byKey.set(
				seatKey(item.at.seatPlanRoomId, item.at.column, item.at.seatNo),
				{
					seatPlanRoomId: item.at.seatPlanRoomId,
					column: item.at.column,
					seatNo: item.at.seatNo,
					offeringId: item.offeringId,
				},
			);
		for (const item of moved)
			if (
				touchesSameCourse(
					byKey,
					item.at.seatPlanRoomId,
					item.at.column,
					item.at.seatNo,
					item.offeringId,
				)
			)
				throw new AppError(
					409,
					"After the swap the same course would sit side by side",
					{ code: "HARD_RULE_VIOLATION", seats: [a.label, b.label] },
				);
		await tx.seatAssignment.deleteMany({ where: { id: { in: [a.id, b.id] } } });
		await tx.seatAssignment.createMany({
			data: [
				{
					seatPlanId: id,
					seatPlanRoomId: a.seatPlanRoomId,
					column: a.column,
					seatNo: a.seatNo,
					label: a.label,
					studentId: b.studentId,
					offeringId: b.offeringId,
				},
				{
					seatPlanId: id,
					seatPlanRoomId: b.seatPlanRoomId,
					column: b.column,
					seatNo: b.seatNo,
					label: b.label,
					studentId: a.studentId,
					offeringId: a.offeringId,
				},
			],
		});
		await createAuditLogIntoDB(tx, {
			actorId,
			action: "SEAT_SWAPPED",
			entity: "SeatPlan",
			entityId: id,
			before: {
				[a.label]: a.studentId,
				[b.label]: b.studentId,
			},
			after: {
				[a.label]: b.studentId,
				[b.label]: a.studentId,
			},
		});
		return {
			published: plan.status === "PUBLISHED",
			students: [a.studentId, b.studentId],
		};
	}, txOptions);
	if (result.published) await emailSeat(result.students, id, true);
	return { swapped: [seatAId, seatBId] };
};

const addLateStudentIntoDB = async (
	id: string,
	actorId: string,
	studentId: string,
) => {
	const result = await prisma.$transaction(async (tx) => {
		const plan = await loadPlan(tx, id);
		const enrollment = await tx.enrollment.findFirst({
			where: {
				studentId,
				status: "ENROLLED",
				offering: { examSlotId: plan.examSlotId },
			},
			select: { offeringId: true },
		});
		if (!enrollment)
			throw new AppError(
				409,
				"The student is not enrolled in a course of this exam slot",
			);
		if (
			await tx.seatAssignment.findFirst({
				where: { seatPlanId: id, studentId },
			})
		)
			throw new AppError(409, "The student already has a seat");
		const seats = await tx.seatAssignment.findMany({
			where: { seatPlanId: id },
			select: {
				seatPlanRoomId: true,
				column: true,
				seatNo: true,
				offeringId: true,
			},
		});
		const byKey = new Map(
			seats.map((row) => [
				seatKey(row.seatPlanRoomId, row.column, row.seatNo),
				row,
			]),
		);
		for (const room of plan.rooms)
			for (let column = 1; column <= columnsOf(room); column++)
				for (let seatNo = 1; seatNo <= columnSize(room, column); seatNo++) {
					if (byKey.has(seatKey(room.id, column, seatNo))) continue;
					if (
						touchesSameCourse(
							byKey,
							room.id,
							column,
							seatNo,
							enrollment.offeringId,
						)
					)
						continue;
					const seat = await tx.seatAssignment.create({
						data: {
							seatPlanId: id,
							seatPlanRoomId: room.id,
							column,
							seatNo,
							label: `${room.roomNo}-C${column}-S${seatNo}`,
							studentId,
							offeringId: enrollment.offeringId,
						},
					});
					await createAuditLogIntoDB(tx, {
						actorId,
						action: "SEAT_ADDED",
						entity: "SeatPlan",
						entityId: id,
						after: { studentId, label: seat.label },
					});
					return { seat, published: plan.status === "PUBLISHED" };
				}
		throw new AppError(409, "There is no free seat for this student", {
			code: "NOT_ENOUGH_SEATS",
		});
	}, txOptions);
	if (result.published) await emailSeat([studentId], id, true);
	return result.seat;
};

const publishSeatPlanIntoDB = async (id: string) => {
	const summary = await getSeatPlanSummaryFromDB(id);
	if (summary.status !== "DRAFT")
		throw new AppError(409, "Only draft seat plans can be published");
	if (!summary.seated) throw new AppError(409, "Generate the seat plan first");
	if (summary.unseated.length || !summary.validation.ok)
		throw new AppError(409, "The seat plan is not valid yet", {
			code: "HARD_RULE_VIOLATION",
			unseated: summary.unseated,
			violations: summary.validation.violations,
		});
	const seated = await prisma.$transaction(async (tx) => {
		const updated = await tx.seatPlan.updateMany({
			where: { id, status: "DRAFT" },
			data: { status: "PUBLISHED", publishedAt: new Date() },
		});
		if (!updated.count)
			throw new AppError(409, "Seat plan was already published");
		const seats = await tx.seatAssignment.findMany({
			where: { seatPlanId: id },
			include: {
				student: { select: { userId: true } },
				room: { select: { roomNo: true } },
			},
		});
		await createNotificationsIntoDB(
			tx,
			seats.map((seat) => ({
				userId: seat.student.userId,
				type: "SEAT_PLAN_PUBLISHED",
				title: "Exam seat published",
				message: `Room ${seat.room.roomNo}, column ${seat.column}, seat ${seat.seatNo}`,
			})),
		);
		return seats.map((seat) => seat.studentId);
	}, txOptions);
	await emailSeat(seated, id, false);
	return prisma.seatPlan.findUniqueOrThrow({ where: { id } });
};

const exportSeatPlanFromDB = async (
	id: string,
	type: "door" | "full" | "attendance",
) => {
	const plan = await loadPlan(prisma, id);
	const seats = await loadSeats(prisma, id);
	const summary = await getSeatPlanSummaryFromDB(id);
	const title = `Exam ${dateOnly(plan.examSlot.date)} ${minutesToTime(plan.examSlot.startMinute)}`;
	return generatePdf((pdf) => {
		let first = true;
		for (const room of plan.rooms) {
			if (!first) pdf.addPage();
			first = false;
			pdf.fontSize(16).text(`${title} — Room ${room.roomNo}`).moveDown(0.5);
			pdf.fontSize(10);
			const inRoom = seats.filter((seat) => seat.room.roomNo === room.roomNo);
			if (type === "door") {
				for (const column of summary.columns.filter(
					(row) => row.roomNo === room.roomNo,
				))
					pdf.text(
						`Column ${column.column}: ${column.courses.join(", ")} — ${column.firstUniversityId} to ${column.lastUniversityId} (${column.count})`,
					);
			} else if (type === "full") {
				for (let column = 1; column <= columnsOf(room); column++) {
					pdf.fontSize(11).text(`Column ${column}`).fontSize(9);
					for (const seat of inRoom
						.filter((row) => row.column === column)
						.sort((a, b) => a.seatNo - b.seatNo))
						pdf.text(
							`  S${seat.seatNo}  ${seat.student.universityId}  ${seat.student.name}  ${seat.offering.course.code}`,
						);
				}
			} else {
				for (const seat of [...inRoom].sort((a, b) =>
					a.student.universityId.localeCompare(b.student.universityId),
				))
					pdf.text(
						`${seat.student.universityId}   ${seat.student.name}   ____________________`,
					);
			}
		}
		if (!plan.rooms.length) pdf.text(title);
	});
};

async function dutyCounts(db: Db, semesterId: string, excludePlanId: string) {
	const rows = await db.invigilatorAssignment.groupBy({
		by: ["facultyId"],
		where: { seatPlan: { semesterId }, seatPlanId: { not: excludePlanId } },
		_count: { _all: true },
	});
	return new Map(rows.map((row) => [row.facultyId, row._count._all]));
}

const autoAssignInvigilatorsIntoDB = (id: string) =>
	prisma.$transaction(async (tx) => {
		const plan = await loadPlan(tx, id);
		const seats = await tx.seatAssignment.groupBy({
			by: ["seatPlanRoomId"],
			where: { seatPlanId: id },
			_count: { _all: true },
		});
		const students = new Map(
			seats.map((row) => [row.seatPlanRoomId, row._count._all]),
		);
		const rooms = plan.rooms.filter((room) => students.get(room.id));
		if (!rooms.length) throw new AppError(409, "Generate the seat plan first");
		const duties = await dutyCounts(tx, plan.semesterId, id);
		const faculty = await tx.faculty.findMany({
			where: { isDeleted: false, user: { status: "ACTIVE" } },
			select: { id: true, name: true },
		});
		const pool = faculty.sort(
			(a, b) =>
				(duties.get(a.id) ?? 0) - (duties.get(b.id) ?? 0) ||
				a.name.localeCompare(b.name) ||
				a.id.localeCompare(b.id),
		);
		const need = rooms.map((room) =>
			Math.max(2, Math.ceil((students.get(room.id) ?? 0) / 40)),
		);
		const total = need.reduce((sum, value) => sum + value, 0);
		if (pool.length < total)
			throw new AppError(
				409,
				`Need ${total} teachers but only ${pool.length} are available`,
			);
		await tx.invigilatorAssignment.deleteMany({ where: { seatPlanId: id } });
		let cursor = 0;
		const data = rooms.flatMap((room, index) =>
			Array.from({ length: need[index] }, () => ({
				seatPlanId: id,
				seatPlanRoomId: room.id,
				facultyId: pool[cursor++].id,
			})),
		);
		await tx.invigilatorAssignment.createMany({ data });
		return rooms.map((room, index) => ({
			roomId: room.id,
			roomNo: room.roomNo,
			facultyIds: data
				.filter((row) => row.seatPlanRoomId === room.id)
				.map((row) => row.facultyId),
			required: need[index],
		}));
	}, txOptions);

const setRoomInvigilatorsIntoDB = (
	id: string,
	roomId: string,
	facultyIds: string[],
) =>
	prisma.$transaction(async (tx) => {
		const plan = await loadPlan(tx, id);
		if (!plan.rooms.some((room) => room.id === roomId))
			throw new AppError(404, "Room not found in this seat plan");
		const unique = [...new Set(facultyIds)];
		if (
			(await tx.faculty.count({
				where: { id: { in: unique }, isDeleted: false },
			})) !== unique.length
		)
			throw new AppError(404, "A teacher was not found");
		const elsewhere = await tx.invigilatorAssignment.findMany({
			where: {
				seatPlanId: id,
				seatPlanRoomId: { not: roomId },
				facultyId: { in: unique },
			},
			select: { facultyId: true, room: { select: { roomNo: true } } },
		});
		if (elsewhere.length)
			throw new AppError(
				409,
				"A teacher is already in another room of this slot",
				{
					teachers: elsewhere.map((row) => ({
						facultyId: row.facultyId,
						roomNo: row.room.roomNo,
					})),
				},
			);
		await tx.invigilatorAssignment.deleteMany({
			where: { seatPlanId: id, seatPlanRoomId: roomId },
		});
		await tx.invigilatorAssignment.createMany({
			data: unique.map((facultyId) => ({
				seatPlanId: id,
				seatPlanRoomId: roomId,
				facultyId,
			})),
		});
		return { roomId, facultyIds: unique };
	}, txOptions);

const getMySeatsFromDB = async (userId: string) => {
	const student = await prisma.student.findUnique({
		where: { userId },
		select: { id: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	const seats = await prisma.seatAssignment.findMany({
		where: { studentId: student.id, seatPlan: { status: "PUBLISHED" } },
		select: {
			column: true,
			seatNo: true,
			label: true,
			room: { select: { roomNo: true } },
			offering: { select: { course: { select: { code: true, title: true } } } },
			seatPlan: {
				select: {
					examSlot: {
						select: {
							id: true,
							date: true,
							startMinute: true,
							endMinute: true,
						},
					},
				},
			},
		},
	});
	return seats
		.map((seat) => ({
			course: seat.offering.course,
			examSlot: seat.seatPlan.examSlot,
			roomNo: seat.room.roomNo,
			column: seat.column,
			seatNo: seat.seatNo,
			label: seat.label,
		}))
		.sort(
			(a, b) =>
				a.examSlot.date.getTime() - b.examSlot.date.getTime() ||
				a.examSlot.startMinute - b.examSlot.startMinute,
		);
};

export const seatPlanService = {
	createSeatPlanIntoDB,
	getSeatPlansOverviewFromDB,
	getLastUsedRoomsFromDB,
	setRoomsIntoDB,
	generateSeatPlanIntoDB,
	getSeatPlanSummaryFromDB,
	getRoomGridFromDB,
	swapSeatsIntoDB,
	addLateStudentIntoDB,
	publishSeatPlanIntoDB,
	exportSeatPlanFromDB,
	autoAssignInvigilatorsIntoDB,
	setRoomInvigilatorsIntoDB,
	getMySeatsFromDB,
};
