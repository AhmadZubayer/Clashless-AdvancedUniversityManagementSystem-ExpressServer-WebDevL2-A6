import { expect, it } from "vitest";
import { generateExamRoutine } from "../../src/app/engine/examRoutineGenerator";
import { validateExamRoutine } from "../../src/app/engine/examRoutineValidator";
import type { IExamOffering } from "../../src/app/engine/examRoutineValidator";

const slot = (id: string, date: string, startMinute: number) => ({
	id,
	date,
	startMinute,
	endMinute: startMinute + 120,
});
const offering = (id: string, studentIds: string[]): IExamOffering => ({
	id,
	label: id,
	studentIds,
});
const slotOf = (
	entries: { offeringId: string; examSlotId: string }[],
	id: string,
) => entries.find((entry) => entry.offeringId === id)?.examSlotId;

it("T-EXAM-01 courses sharing students go to different slots", () => {
	const offerings = [
		offering("A", ["s1", "s2"]),
		offering("B", ["s2", "s3"]),
		offering("C", ["s4"]),
		offering("D", ["s5"]),
	];
	const slots = [slot("x", "2026-12-20", 540), slot("y", "2026-12-21", 540)];
	const result = generateExamRoutine({
		offerings,
		slots,
		maxStudentsPerSlot: 100,
	});
	expect(result.entries).toHaveLength(4);
	expect(slotOf(result.entries, "A")).not.toBe(slotOf(result.entries, "B"));
	expect(result.report.unplaced).toEqual([]);
	expect(
		validateExamRoutine({ offerings, slots, entries: result.entries }).ok,
	).toBe(true);
});

it("T-EXAM-02 three mutually sharing courses in two slots leave one unplaced with its blockers", () => {
	const offerings = [
		offering("A", ["s1", "s2"]),
		offering("B", ["s1", "s3"]),
		offering("C", ["s2", "s3", "s1"]),
	];
	const result = generateExamRoutine({
		offerings,
		slots: [slot("x", "2026-12-20", 540), slot("y", "2026-12-21", 540)],
		maxStudentsPerSlot: 100,
	});
	expect(result.report.unplaced).toHaveLength(1);
	const [missing] = result.report.unplaced;
	expect(missing.blockedBy.sort()).toEqual(
		offerings.map((row) => row.id).filter((id) => id !== missing.offeringId),
	);
	expect(result.entries).toHaveLength(2);
});

it("T-EXAM-03 a seat limit smaller than two courses together separates them", () => {
	const offerings = [
		offering("A", ["s1", "s2", "s3"]),
		offering("B", ["s4", "s5", "s6"]),
	];
	const result = generateExamRoutine({
		offerings,
		slots: [slot("x", "2026-12-20", 540), slot("y", "2026-12-20", 780)],
		maxStudentsPerSlot: 4,
	});
	expect(slotOf(result.entries, "A")).not.toBe(slotOf(result.entries, "B"));
	expect(result.report.unplaced).toEqual([]);
});

it("the validator reports clashes, unplaced courses and over-capacity slots", () => {
	const offerings = [
		offering("A", ["s1"]),
		offering("B", ["s1"]),
		offering("C", ["s2"]),
	];
	const slots = [slot("x", "2026-12-20", 540)];
	const bad = validateExamRoutine({
		offerings,
		slots,
		entries: [
			{ offeringId: "A", examSlotId: "x" },
			{ offeringId: "B", examSlotId: "x" },
		],
		maxStudentsPerSlot: 1,
	});
	expect(bad.ok).toBe(false);
	expect(bad.violations.map((row) => row.type).sort()).toEqual([
		"SLOT_OVER_CAPACITY",
		"STUDENT_CLASH",
		"UNPLACED",
	]);
});
