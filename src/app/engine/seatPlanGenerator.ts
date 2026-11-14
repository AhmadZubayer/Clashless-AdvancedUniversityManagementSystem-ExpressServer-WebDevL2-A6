import { columnSize, columnsOf } from "./seatPlanValidator";
import type { ISeat, ISeatRoom } from "./seatPlanValidator";

export interface ISeatStudent {
	id: string;
	universityId: string;
	name: string;
}

export interface ISeatOffering {
	id: string;
	code: string;
	students: ISeatStudent[];
}

export interface ISeatPlanGenerationInput {
	offerings: ISeatOffering[];
	rooms: ISeatRoom[];
	orderBy: "STUDENT_ID" | "NAME";
}

export class NotEnoughSeatsError extends Error {
	constructor(
		message: string,
		readonly details: {
			offeringId: string;
			courseCode: string;
			students: number;
			group: "A" | "B";
			missingSeats: number;
		},
	) {
		super(message);
	}
}

export interface ISeatPlanReport {
	columns: {
		roomNo: string;
		column: number;
		offeringId: string | null;
		code: string | null;
		firstUniversityId: string | null;
		lastUniversityId: string | null;
		count: number;
		seats: number;
	}[];
	emptySeats: number;
	unusedRooms: string[];
}

interface IPosition {
	roomNo: string;
	column: number;
	seatNo: number;
}

// Positions in fill order: rooms, then columns left to right, then seats front to back.
function positions(rooms: ISeatRoom[], parity: 0 | 1) {
	const list: IPosition[] = [];
	for (const room of rooms)
		for (let column = 1; column <= columnsOf(room); column++) {
			if (column % 2 !== (parity === 0 ? 1 : 0)) continue;
			for (let seatNo = 1; seatNo <= columnSize(room, column); seatNo++)
				list.push({ roomNo: room.roomNo, column, seatNo });
		}
	return list;
}

export function generateSeatPlan(input: ISeatPlanGenerationInput) {
	const compare = (a: ISeatStudent, b: ISeatStudent) =>
		input.orderBy === "NAME"
			? a.name.localeCompare(b.name) ||
				a.universityId.localeCompare(b.universityId)
			: a.universityId.localeCompare(b.universityId);
	const groupSeats = {
		A: positions(input.rooms, 0),
		B: positions(input.rooms, 1),
	};

	// 3. split: largest course first into the group with more free seats (ties: A)
	const free = { A: groupSeats.A.length, B: groupSeats.B.length };
	const group = new Map<string, "A" | "B">();
	const bySize = [...input.offerings].sort(
		(a, b) =>
			b.students.length - a.students.length || a.code.localeCompare(b.code),
	);
	for (const offering of bySize) {
		const size = offering.students.length;
		const target: "A" | "B" = free.B > free.A ? "B" : "A";
		if (size > free[target])
			throw new NotEnoughSeatsError(
				`${offering.code} (${size} students) needs ${size} ${target === "A" ? "odd" : "even"}-column seats; only ${free[target]} are left`,
				{
					offeringId: offering.id,
					courseCode: offering.code,
					students: size,
					group: target,
					missingSeats: size - free[target],
				},
			);
		group.set(offering.id, target);
		free[target] -= size;
	}

	// 4. fill: courses in code order, continuing from the next seat
	const seats: (ISeat & { universityId: string; code: string })[] = [];
	for (const key of ["A", "B"] as const) {
		const queue = input.offerings
			.filter((row) => group.get(row.id) === key)
			.sort((a, b) => a.code.localeCompare(b.code));
		let cursor = 0;
		for (const offering of queue)
			for (const student of [...offering.students].sort(compare)) {
				const position = groupSeats[key][cursor++];
				seats.push({
					...position,
					studentId: student.id,
					offeringId: offering.id,
					universityId: student.universityId,
					code: offering.code,
				});
			}
	}

	// 7. report
	const columns = new Map<string, ISeatPlanReport["columns"][number]>();
	const usedRooms = new Set<string>();
	for (const room of input.rooms)
		for (let column = 1; column <= columnsOf(room); column++)
			columns.set(`${room.roomNo}|${column}`, {
				roomNo: room.roomNo,
				column,
				offeringId: null,
				code: null,
				firstUniversityId: null,
				lastUniversityId: null,
				count: 0,
				seats: columnSize(room, column),
			});
	for (const seat of seats) {
		usedRooms.add(seat.roomNo);
		const row = columns.get(`${seat.roomNo}|${seat.column}`);
		if (!row) continue;
		// A column may hold the end of one course and the start of the next.
		if (row.offeringId && row.offeringId !== seat.offeringId) {
			row.code = `${row.code}, ${seat.code}`;
			row.offeringId = `${row.offeringId},${seat.offeringId}`;
		} else {
			row.offeringId = seat.offeringId;
			row.code = row.code ?? seat.code;
		}
		row.firstUniversityId = row.firstUniversityId ?? seat.universityId;
		row.lastUniversityId = seat.universityId;
		row.count += 1;
	}
	const totalSeats = input.rooms.reduce(
		(sum, room) => sum + room.totalSeats,
		0,
	);
	const report: ISeatPlanReport = {
		columns: [...columns.values()],
		emptySeats: totalSeats - seats.length,
		unusedRooms: input.rooms
			.filter((room) => !usedRooms.has(room.roomNo))
			.map((room) => room.roomNo),
	};
	return { seats, report };
}
