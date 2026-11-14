import { expect, it } from "vitest";
import { validateRoutine } from "../../src/app/engine/routineValidator";
import type { IRoutineInput } from "../../src/app/engine/routineValidator";

function fixture(): IRoutineInput {
	return {
		sections: [
			{ id: "a", type: "THEORY", capacity: 40, facultyId: "teacher-a" },
			{ id: "b", type: "THEORY", capacity: 40, facultyId: "teacher-b" },
		],
		rooms: [
			{
				id: "room",
				code: "FUB-301",
				type: "CLASSROOM",
				capacity: 40,
				isActive: true,
			},
		],
		timeSlots: [
			{
				id: "morning",
				type: "THEORY",
				startMinute: 510,
				endMinute: 600,
				isActive: true,
			},
			{
				id: "next",
				type: "THEORY",
				startMinute: 600,
				endMinute: 690,
				isActive: true,
			},
			{
				id: "lab",
				type: "LAB",
				startMinute: 540,
				endMinute: 720,
				isActive: true,
			},
		],
		dayPatterns: [{ id: "st", type: "THEORY", days: ["SUN", "TUE"] }],
		preferences: [],
		entries: [
			{
				sectionId: "a",
				roomId: "room",
				dayPatternId: "st",
				timeSlotId: "morning",
			},
			{
				sectionId: "b",
				roomId: "room",
				dayPatternId: "st",
				timeSlotId: "morning",
			},
		],
	};
}
it("T-ROUT-05 validator reports one double-booking naming the room", () => {
	const result = validateRoutine(fixture());
	expect(result.ok).toBe(false);
	expect(result.violations).toHaveLength(1);
	expect(result.violations[0]).toMatchObject({
		code: "ROOM_CLASH",
		sectionIds: ["a", "b"],
	});
	expect(result.violations[0].message).toContain("FUB-301");
});
it("F5 validator permits touching time boundaries and checks unavailability across slot types", () => {
	const input = fixture();
	input.entries[1].timeSlotId = "next";
	expect(validateRoutine(input).ok).toBe(true);
	input.preferences.push({
		facultyId: "teacher-a",
		day: "SUN",
		timeSlotId: "lab",
		kind: "UNAVAILABLE",
	});
	expect(validateRoutine(input).violations.map((row) => row.code)).toEqual([
		"FACULTY_UNAVAILABLE",
	]);
});
it("F5 validator checks active room, capacity and matching resource types", () => {
	const input = fixture();
	input.entries = input.entries.slice(0, 1);
	input.rooms[0] = {
		...input.rooms[0],
		capacity: 20,
		isActive: false,
		type: "LAB",
	};
	input.entries[0].timeSlotId = "lab";
	input.dayPatterns[0].days = ["SUN"];
	expect(validateRoutine(input).violations.map((row) => row.code)).toEqual([
		"ROOM_INCOMPATIBLE",
		"SLOT_INCOMPATIBLE",
		"PATTERN_INCOMPATIBLE",
	]);
});
