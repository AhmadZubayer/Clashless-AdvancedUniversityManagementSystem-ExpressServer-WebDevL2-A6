import { expect, it } from "vitest";
import {
	generateRoutine,
	scoreRoutine,
} from "../../src/app/engine/routineGenerator";
import type { IRoutineGenerationInput } from "../../src/app/engine/routineGenerator";
import { validateRoutine } from "../../src/app/engine/routineValidator";

function fixture(): IRoutineGenerationInput {
	return {
		semesterId: "repeatable-semester",
		sections: Array.from({ length: 6 }, (_, index) => ({
			id: `s${index}`,
			courseId: `c${index % 2}`,
			facultyId: `teacher${index % 2}`,
			type: "THEORY",
			capacity: 40,
		})),
		rooms: Array.from({ length: 3 }, (_, index) => ({
			id: `r${index}`,
			code: `ROOM-${index}`,
			type: "CLASSROOM",
			capacity: 40,
			isActive: true,
		})),
		timeSlots: Array.from({ length: 5 }, (_, index) => ({
			id: `t${index}`,
			type: "THEORY",
			startMinute: 510 + index * 90,
			endMinute: 600 + index * 90,
			isActive: true,
		})),
		dayPatterns: [
			{ id: "st", type: "THEORY", days: ["SUN", "TUE"] },
			{ id: "mw", type: "THEORY", days: ["MON", "WED"] },
		],
		preferences: [],
		curriculum: [],
	};
}

it("T-ROUT-01 places six theory sections in three rooms without hard conflicts", () => {
	const input = fixture();
	const result = generateRoutine(input);
	expect(result.entries).toHaveLength(6);
	expect(result.report.unplaced).toEqual([]);
	expect(validateRoutine({ ...input, entries: result.entries }).ok).toBe(true);
});
it("T-ROUT-02 respects teacher unavailability in every slot except one", () => {
	const input = fixture();
	for (const day of ["SUN", "TUE", "MON", "WED"])
		for (const slot of input.timeSlots.slice(0, 4))
			input.preferences.push({
				facultyId: "teacher0",
				day,
				timeSlotId: slot.id,
				kind: "UNAVAILABLE",
			});
	const result = generateRoutine(input);
	const teacherIds = new Set(
		input.sections
			.filter((row) => row.facultyId === "teacher0")
			.map((row) => row.id),
	);
	expect(
		result.entries
			.filter((row) => teacherIds.has(row.sectionId))
			.every((row) => row.timeSlotId === "t4"),
	).toBe(true);
	expect(result.report.unplaced).toHaveLength(1);
	expect(result.report.unplaced[0].reason).toContain("available");
	expect(validateRoutine({ ...input, entries: result.entries }).ok).toBe(true);
});
it("T-ROUT-03 an undersized lab room produces an explicit room-size reason", () => {
	const input = fixture();
	input.sections = [
		{
			id: "lab",
			courseId: "lab-course",
			facultyId: "teacher0",
			type: "LAB",
			capacity: 40,
		},
	];
	input.rooms = [
		{
			id: "lab-room",
			code: "LAB-20",
			type: "LAB",
			capacity: 20,
			isActive: true,
		},
	];
	input.timeSlots = [
		{
			id: "lab-slot",
			type: "LAB",
			startMinute: 510,
			endMinute: 690,
			isActive: true,
		},
	];
	input.dayPatterns = [{ id: "s", type: "LAB", days: ["SUN"] }];
	const result = generateRoutine(input);
	expect(result.entries).toEqual([]);
	expect(result.report.unplaced).toHaveLength(1);
	expect(result.report.unplaced[0].reason).toMatch(/LAB.*40 seats/);
});
it("T-ROUT-04 identical seeded input produces identical complete output", () => {
	const input = fixture();
	input.preferences = [
		{ facultyId: "teacher0", day: "SUN", timeSlotId: "t0", kind: "PREFERRED" },
	];
	expect(generateRoutine(input)).toEqual(generateRoutine(input));
});
it("T-ROUT-06 same-term courses retain at least one clash-free section pair", () => {
	const input = fixture();
	input.curriculum = [
		{ courseId: "c0", programId: "program", term: 1 },
		{ courseId: "c1", programId: "program", term: 1 },
	];
	const result = generateRoutine(input);
	expect(result.entries).toHaveLength(6);
	expect(scoreRoutine(input, result.entries).breakdown.curriculumClashes).toBe(
		0,
	);
});
it("F6 pinned entries survive generation and invalid pins are rejected", () => {
	const input = fixture();
	const entry = {
		sectionId: "s0",
		roomId: "r2",
		dayPatternId: "mw",
		timeSlotId: "t3",
		isPinned: true,
	};
	input.pinnedEntries = [entry];
	expect(generateRoutine(input).entries).toContainEqual(entry);
	input.pinnedEntries.push({ ...entry, sectionId: "s1" });
	expect(() => generateRoutine(input)).toThrow(
		"Pinned entries violate hard rules",
	);
});
it("F6 scoring counts curriculum, preferred, consecutive and concentration penalties", () => {
	const input = fixture();
	input.sections = [0, 1, 2, 3].map((index) => ({
		id: `a${index}`,
		courseId: "a",
		facultyId: "teacher-a",
		type: "THEORY",
		capacity: 40,
	}));
	input.sections.push({
		id: "b",
		courseId: "b",
		facultyId: "teacher-b",
		type: "THEORY",
		capacity: 40,
	});
	input.curriculum = [
		{ courseId: "a", programId: "p", term: 1 },
		{ courseId: "b", programId: "p", term: 1 },
	];
	input.preferences = [
		{ facultyId: "teacher-a", day: "SUN", timeSlotId: "t0", kind: "PREFERRED" },
	];
	const entries = input.sections.map((row, index) => ({
		sectionId: row.id,
		roomId: "r0",
		dayPatternId: "st",
		timeSlotId: `t${index === 4 ? 0 : index}`,
	}));
	const score = scoreRoutine(input, entries);
	expect(score.breakdown).toEqual({
		curriculumClashes: 0,
		outsidePreferred: 8,
		consecutiveClasses: 10,
		concentratedDays: 0,
	});
	expect(score.total).toBe(18);
	input.dayPatterns = [{ id: "s", type: "LAB", days: ["SUN"] }];
	input.sections = input.sections
		.slice(0, 3)
		.map((row) => ({ ...row, type: "LAB" }));
	input.preferences = [];
	expect(
		scoreRoutine(
			input,
			entries.slice(0, 3).map((row) => ({ ...row, dayPatternId: "s" })),
		).breakdown.concentratedDays,
	).toBe(3);
});
