import { overlaps } from "../utils/time";

export interface IRoutineSection {
	id: string;
	type: "THEORY" | "LAB";
	capacity: number;
	facultyId: string | null;
}
export interface IRoutineRoom {
	id: string;
	code: string;
	type: "CLASSROOM" | "LAB";
	capacity: number;
	isActive: boolean;
}
export interface IRoutineTimeSlot {
	id: string;
	type: "THEORY" | "LAB";
	startMinute: number;
	endMinute: number;
	isActive: boolean;
}
export interface IRoutineDayPattern {
	id: string;
	type: "THEORY" | "LAB";
	days: string[];
}
export interface IRoutinePreference {
	facultyId: string;
	day: string;
	timeSlotId: string;
	kind: "PREFERRED" | "UNAVAILABLE";
}
export interface IRoutineEntry {
	sectionId: string;
	roomId: string;
	dayPatternId: string;
	timeSlotId: string;
	isPinned?: boolean;
}
export interface IRoutineInput {
	sections: IRoutineSection[];
	rooms: IRoutineRoom[];
	timeSlots: IRoutineTimeSlot[];
	dayPatterns: IRoutineDayPattern[];
	preferences: IRoutinePreference[];
	entries: IRoutineEntry[];
}
export interface IRoutineViolation {
	code: string;
	message: string;
	sectionIds: string[];
}

/** Validates placed entries. Coverage of all sections is a publication rule. */
export function validateRoutine(input: IRoutineInput) {
	const violations: IRoutineViolation[] = [];
	const sections = new Map(input.sections.map((row) => [row.id, row]));
	const rooms = new Map(input.rooms.map((row) => [row.id, row]));
	const slots = new Map(input.timeSlots.map((row) => [row.id, row]));
	const patterns = new Map(input.dayPatterns.map((row) => [row.id, row]));
	const seen = new Set<string>();
	const placed: {
		entry: IRoutineEntry;
		section: IRoutineSection;
		slot: IRoutineTimeSlot;
		pattern: IRoutineDayPattern;
	}[] = [];
	const add = (code: string, message: string, ...sectionIds: string[]) =>
		violations.push({ code, message, sectionIds });
	for (const entry of input.entries) {
		const section = sections.get(entry.sectionId);
		const room = rooms.get(entry.roomId);
		const slot = slots.get(entry.timeSlotId);
		const pattern = patterns.get(entry.dayPatternId);
		if (seen.has(entry.sectionId))
			add(
				"DUPLICATE_SECTION",
				"Section is placed more than once",
				entry.sectionId,
			);
		seen.add(entry.sectionId);
		if (!section || !room || !slot || !pattern) {
			add(
				"MISSING_RESOURCE",
				"Schedule references a missing section, room, slot or pattern",
				entry.sectionId,
			);
			continue;
		}
		if (
			!room.isActive ||
			room.capacity < section.capacity ||
			room.type !== (section.type === "LAB" ? "LAB" : "CLASSROOM")
		)
			add(
				"ROOM_INCOMPATIBLE",
				`Room ${room.code} must be active, match the course type and seat at least ${section.capacity}`,
				section.id,
			);
		if (
			!slot.isActive ||
			slot.type !== section.type ||
			slot.startMinute < 0 ||
			slot.endMinute > 1440 ||
			slot.startMinute >= slot.endMinute
		)
			add(
				"SLOT_INCOMPATIBLE",
				"Time slot must be active and match the course type with a valid time range",
				section.id,
			);
		if (
			pattern.type !== section.type ||
			pattern.days.length !== (section.type === "LAB" ? 1 : 2) ||
			new Set(pattern.days).size !== pattern.days.length
		)
			add(
				"PATTERN_INCOMPATIBLE",
				"Day pattern must match the course type and required number of distinct days",
				section.id,
			);
		if (
			section.facultyId &&
			input.preferences.some((preference) => {
				const unavailableSlot = slots.get(preference.timeSlotId);
				return (
					preference.facultyId === section.facultyId &&
					preference.kind === "UNAVAILABLE" &&
					pattern.days.includes(preference.day) &&
					unavailableSlot &&
					overlaps(slot, unavailableSlot)
				);
			})
		)
			add(
				"FACULTY_UNAVAILABLE",
				"Teacher is unavailable during this class",
				section.id,
			);
		for (const other of placed) {
			if (
				!pattern.days.some((day) => other.pattern.days.includes(day)) ||
				!overlaps(slot, other.slot)
			)
				continue;
			if (entry.roomId === other.entry.roomId)
				add(
					"ROOM_CLASH",
					`Room ${room.code} is double-booked`,
					other.section.id,
					section.id,
				);
			if (section.facultyId && section.facultyId === other.section.facultyId)
				add(
					"FACULTY_CLASH",
					"Teacher has overlapping classes",
					other.section.id,
					section.id,
				);
		}
		placed.push({ entry, section, slot, pattern });
	}
	return { ok: violations.length === 0, violations };
}
