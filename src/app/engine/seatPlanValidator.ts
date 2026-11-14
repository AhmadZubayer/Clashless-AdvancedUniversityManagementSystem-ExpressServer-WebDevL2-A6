export interface ISeatRoom {
	roomNo: string;
	totalSeats: number;
	seatsPerColumn: number;
}

export interface ISeat {
	roomNo: string;
	column: number; // 1-based
	seatNo: number; // 1 = front
	studentId: string;
	offeringId: string;
}

export interface ISeatPlanValidationInput {
	students: { studentId: string; offeringId: string }[];
	rooms: ISeatRoom[];
	seats: ISeat[];
}

export type SeatViolation =
	| { type: "UNSEATED"; studentId: string }
	| { type: "SEATED_TWICE"; studentId: string }
	| { type: "NOT_IN_SLOT"; studentId: string }
	| { type: "ROOM_OVER_CAPACITY"; roomNo: string; seated: number }
	| {
			type: "SEAT_OUTSIDE_ROOM";
			roomNo: string;
			column: number;
			seatNo: number;
	  }
	| { type: "SEAT_TAKEN_TWICE"; roomNo: string; column: number; seatNo: number }
	| {
			type: "SAME_COURSE_NEIGHBOURS";
			roomNo: string;
			seatNo: number;
			columns: [number, number];
			offeringId: string;
	  };

export const columnsOf = (room: ISeatRoom) =>
	Math.ceil(room.totalSeats / room.seatsPerColumn);

// Seats in one column: seatsPerColumn, except the last column which holds the remainder.
export const columnSize = (room: ISeatRoom, column: number) =>
	column < columnsOf(room)
		? room.seatsPerColumn
		: room.totalSeats - room.seatsPerColumn * (columnsOf(room) - 1);

export const seatKey = (roomNo: string, column: number, seatNo: number) =>
	`${roomNo}|${column}|${seatNo}`;

// Every enrolled student seated once, no room over capacity, no seat shared,
// and no seat with the same course directly to its left or right.
export function validateSeatPlan(input: ISeatPlanValidationInput) {
	const violations: SeatViolation[] = [];
	const roomByNo = new Map(input.rooms.map((room) => [room.roomNo, room]));
	const enrolled = new Set(input.students.map((row) => row.studentId));
	const seatedCount = new Map<string, number>();
	const perRoom = new Map<string, number>();
	const taken = new Set<string>();
	const byKey = new Map<string, ISeat>();
	for (const seat of input.seats) {
		seatedCount.set(seat.studentId, (seatedCount.get(seat.studentId) ?? 0) + 1);
		perRoom.set(seat.roomNo, (perRoom.get(seat.roomNo) ?? 0) + 1);
		const room = roomByNo.get(seat.roomNo);
		if (
			!room ||
			seat.column < 1 ||
			seat.column > columnsOf(room) ||
			seat.seatNo < 1 ||
			seat.seatNo > columnSize(room, seat.column)
		)
			violations.push({
				type: "SEAT_OUTSIDE_ROOM",
				roomNo: seat.roomNo,
				column: seat.column,
				seatNo: seat.seatNo,
			});
		const key = seatKey(seat.roomNo, seat.column, seat.seatNo);
		if (taken.has(key))
			violations.push({
				type: "SEAT_TAKEN_TWICE",
				roomNo: seat.roomNo,
				column: seat.column,
				seatNo: seat.seatNo,
			});
		taken.add(key);
		byKey.set(key, seat);
	}
	for (const studentId of enrolled)
		if (!seatedCount.has(studentId))
			violations.push({ type: "UNSEATED", studentId });
	for (const [studentId, count] of seatedCount) {
		if (count > 1) violations.push({ type: "SEATED_TWICE", studentId });
		if (!enrolled.has(studentId))
			violations.push({ type: "NOT_IN_SLOT", studentId });
	}
	for (const [roomNo, seated] of perRoom) {
		const room = roomByNo.get(roomNo);
		if (room && seated > room.totalSeats)
			violations.push({ type: "ROOM_OVER_CAPACITY", roomNo, seated });
	}
	for (const seat of input.seats) {
		const right = byKey.get(seatKey(seat.roomNo, seat.column + 1, seat.seatNo));
		if (right && right.offeringId === seat.offeringId)
			violations.push({
				type: "SAME_COURSE_NEIGHBOURS",
				roomNo: seat.roomNo,
				seatNo: seat.seatNo,
				columns: [seat.column, seat.column + 1],
				offeringId: seat.offeringId,
			});
	}
	return { ok: violations.length === 0, violations };
}

// True when placing `offeringId` at this seat would sit next to the same course.
export function touchesSameCourse(
	byKey: Map<string, { offeringId: string }>,
	roomNo: string,
	column: number,
	seatNo: number,
	offeringId: string,
) {
	return [column - 1, column + 1].some(
		(other) =>
			byKey.get(seatKey(roomNo, other, seatNo))?.offeringId === offeringId,
	);
}
