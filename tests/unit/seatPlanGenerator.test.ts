import { expect, it } from "vitest";
import {
	NotEnoughSeatsError,
	generateSeatPlan,
} from "../../src/app/engine/seatPlanGenerator";
import type { ISeatOffering } from "../../src/app/engine/seatPlanGenerator";
import {
	columnSize,
	columnsOf,
	validateSeatPlan,
} from "../../src/app/engine/seatPlanValidator";

const makeOffering = (
	id: string,
	count: number,
	options: { namePrefix?: string; reverseNames?: boolean } = {},
): ISeatOffering => ({
	id,
	code: id,
	students: Array.from({ length: count }, (_, index) => ({
		id: `${id}-s${index}`,
		universityId: `${id}-${String(index + 1).padStart(4, "0")}`,
		name: options.reverseNames
			? `${options.namePrefix ?? ""}${String(count - index).padStart(4, "0")}`
			: `${options.namePrefix ?? ""}${String(index).padStart(4, "0")}`,
	})),
});

const rooms = (nos: string[], total = 40, per = 8) =>
	nos.map((roomNo) => ({ roomNo, totalSeats: total, seatsPerColumn: per }));

const validate = (
	offerings: ISeatOffering[],
	plan: ReturnType<typeof generateSeatPlan>,
	roomList: ReturnType<typeof rooms>,
) =>
	validateSeatPlan({
		students: offerings.flatMap((offering) =>
			offering.students.map((student) => ({
				studentId: student.id,
				offeringId: offering.id,
			})),
		),
		rooms: roomList,
		seats: plan.seats,
	});

it("T-SEAT-01 the worked example: 70 + 45 students in three 40-seat rooms", () => {
	const offerings = [makeOffering("CSE215", 70), makeOffering("MAT205", 45)];
	const roomList = rooms(["301", "302", "303"]);
	const plan = generateSeatPlan({
		offerings,
		rooms: roomList,
		orderBy: "STUDENT_ID",
	});
	const first = plan.seats.find(
		(seat) => seat.roomNo === "301" && seat.column === 1 && seat.seatNo === 1,
	);
	expect(first?.universityId).toBe("CSE215-0001");
	for (const column of plan.report.columns)
		if (column.count) expect(column.code).not.toContain(",");
	// 2 + 3 empty seats in room 303
	const seatsIn303 = plan.seats.filter((seat) => seat.roomNo === "303");
	expect(120 - plan.seats.length).toBe(5);
	expect(seatsIn303.filter((seat) => seat.offeringId === "CSE215").length).toBe(
		22,
	);
	expect(seatsIn303.filter((seat) => seat.offeringId === "MAT205").length).toBe(
		13,
	);
	expect(plan.report.emptySeats).toBe(5);
	expect(validate(offerings, plan, roomList).ok).toBe(true);
});

it("T-SEAT-02 orderBy NAME sorts each course by name", () => {
	const offerings = [
		makeOffering("CSE215", 20, { reverseNames: true }),
		makeOffering("MAT205", 10),
	];
	const plan = generateSeatPlan({
		offerings,
		rooms: rooms(["301"]),
		orderBy: "NAME",
	});
	const names = plan.seats
		.filter((seat) => seat.offeringId === "CSE215")
		.map(
			(seat) =>
				offerings[0].students.find((s) => s.id === seat.studentId)?.name ?? "",
		);
	expect(names).toEqual([...names].sort());
});

it("T-SEAT-03 43 seats with 8 per column make 6 columns, the last with 3 seats", () => {
	const room = { roomNo: "1", totalSeats: 43, seatsPerColumn: 8 };
	expect(columnsOf(room)).toBe(6);
	expect(columnSize(room, 5)).toBe(8);
	expect(columnSize(room, 6)).toBe(3);
});

it("T-SEAT-04 one course of 100 students does not fit two 40-seat rooms", () => {
	try {
		generateSeatPlan({
			offerings: [makeOffering("BIG", 100)],
			rooms: rooms(["1", "2"]),
			orderBy: "STUDENT_ID",
		});
		expect.unreachable();
	} catch (error) {
		expect(error).toBeInstanceOf(NotEnoughSeatsError);
		const details = (error as NotEnoughSeatsError).details;
		expect(details.group).toBe("A");
		expect(details.missingSeats).toBe(100 - 48);
	}
});

it("T-SEAT-05 courses of 50, 30 and 20 split into groups A and B", () => {
	const offerings = [
		makeOffering("C50", 50),
		makeOffering("C20", 20),
		makeOffering("C30", 30),
	];
	// two 60-seat rooms, 10 per column: 30 odd + 30 even seats per room
	const roomList = rooms(["1", "2"], 60, 10);
	const plan = generateSeatPlan({
		offerings,
		rooms: roomList,
		orderBy: "STUDENT_ID",
	});
	const oddCourses = new Set(
		plan.seats
			.filter((seat) => seat.column % 2 === 1)
			.map((seat) => seat.offeringId),
	);
	const evenCourses = new Set(
		plan.seats
			.filter((seat) => seat.column % 2 === 0)
			.map((seat) => seat.offeringId),
	);
	expect([...oddCourses]).toEqual(["C50"]);
	expect([...evenCourses].sort()).toEqual(["C20", "C30"]);
	// C30 comes first in code order? "C20" < "C30": C20 fills first, C30 continues right after
	const even = plan.seats.filter((seat) => seat.column % 2 === 0);
	const lastOfFirst = even.findLastIndex((seat) => seat.offeringId === "C20");
	expect(even[lastOfFirst + 1].offeringId).toBe("C30");
	expect(validate(offerings, plan, roomList).ok).toBe(true);
});

it("T-SEAT-06 the validator names seats with the same course side by side", () => {
	const roomList = rooms(["1"]);
	const result = validateSeatPlan({
		students: [
			{ studentId: "a", offeringId: "X" },
			{ studentId: "b", offeringId: "X" },
		],
		rooms: roomList,
		seats: [
			{ roomNo: "1", column: 1, seatNo: 1, studentId: "a", offeringId: "X" },
			{ roomNo: "1", column: 2, seatNo: 1, studentId: "b", offeringId: "X" },
		],
	});
	expect(result.ok).toBe(false);
	expect(result.violations).toContainEqual({
		type: "SAME_COURSE_NEIGHBOURS",
		roomNo: "1",
		seatNo: 1,
		columns: [1, 2],
		offeringId: "X",
	});
});

it("T-SEAT-13 5,000 students in one slot are seated in under 10 seconds", () => {
	const offerings = Array.from({ length: 20 }, (_, index) =>
		makeOffering(`C${String(index).padStart(2, "0")}`, 250),
	);
	const roomList = rooms(
		Array.from({ length: 40 }, (_, index) => String(100 + index)),
		200,
		20,
	);
	const started = Date.now();
	const plan = generateSeatPlan({
		offerings,
		rooms: roomList,
		orderBy: "STUDENT_ID",
	});
	expect(validate(offerings, plan, roomList).ok).toBe(true);
	expect(plan.seats).toHaveLength(5000);
	expect(Date.now() - started).toBeLessThan(10000);
});
