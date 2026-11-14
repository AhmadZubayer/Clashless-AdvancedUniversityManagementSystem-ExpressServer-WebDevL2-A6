import { overlaps } from "../utils/time";
import { validateRoutine } from "./routineValidator";
import type {
	IRoutineEntry,
	IRoutineInput,
	IRoutineSection,
	IRoutineTimeSlot,
	IRoutineDayPattern,
} from "./routineValidator";

export interface IGenerationSection extends IRoutineSection {
	courseId: string;
	label?: string;
}
export interface IRoutineGenerationInput
	extends Omit<IRoutineInput, "entries" | "sections"> {
	semesterId: string;
	sections: IGenerationSection[];
	curriculum: { courseId: string; programId: string; term: number }[];
	pinnedEntries?: IRoutineEntry[];
}
export interface IRoutineScore {
	total: number;
	breakdown: {
		curriculumClashes: number;
		outsidePreferred: number;
		consecutiveClasses: number;
		concentratedDays: number;
	};
}
interface ICandidate extends IRoutineEntry {
	pattern: IRoutineDayPattern;
	slot: IRoutineTimeSlot;
}

function seededRandom(seed: string) {
	let state = 2166136261;
	for (const char of seed)
		state = Math.imul(state ^ char.charCodeAt(0), 16777619);
	return () => {
		state += 0x6d2b79f5;
		let value = Math.imul(state ^ (state >>> 15), state | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

const classesClash = (a: ICandidate, b: ICandidate) =>
	a.pattern.days.some((day) => b.pattern.days.includes(day)) &&
	overlaps(a.slot, b.slot);

function scoringContext(input: IRoutineGenerationInput) {
	const sections = new Map(
		input.sections.map((section) => [section.id, section]),
	);
	const slots = new Map(input.timeSlots.map((slot) => [slot.id, slot]));
	const patterns = new Map(
		input.dayPatterns.map((pattern) => [pattern.id, pattern]),
	);
	const preferences = new Map<string, typeof input.preferences>();
	for (const preference of input.preferences) {
		const rows = preferences.get(preference.facultyId) ?? [];
		rows.push(preference);
		preferences.set(preference.facultyId, rows);
	}
	const groups = new Map<string, Set<string>>();
	for (const row of input.curriculum) {
		const key = `${row.programId}:${row.term}`;
		const courses = groups.get(key) ?? new Set<string>();
		courses.add(row.courseId);
		groups.set(key, courses);
	}
	// A pair may incur a penalty once in each program/term that contains it.
	const pairs: [string, string][] = [];
	for (const courses of groups.values()) {
		const ids = [...courses].sort();
		for (let i = 0; i < ids.length; i++)
			for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
	}
	const candidate = (entry: IRoutineEntry): ICandidate => {
		const pattern = patterns.get(entry.dayPatternId);
		const slot = slots.get(entry.timeSlotId);
		if (!pattern || !slot)
			throw new Error(
				"Routine entry references a missing day pattern or time slot",
			);
		return { ...entry, pattern, slot };
	};
	const outsidePreferred = (section: IGenerationSection, entry: ICandidate) => {
		const preferred = (preferences.get(section.facultyId ?? "") ?? []).filter(
			(row) => row.kind === "PREFERRED",
		);
		if (!preferred.length) return 0;
		return entry.pattern.days.every((day) =>
			preferred.some((row) => {
				const slot = slots.get(row.timeSlotId);
				return (
					row.day === day &&
					slot &&
					slot.startMinute <= entry.slot.startMinute &&
					slot.endMinute >= entry.slot.endMinute
				);
			}),
		)
			? 0
			: 2;
	};
	const teacherScore = (entries: ICandidate[]) => {
		const byDay = new Map<string, ICandidate[]>();
		for (const entry of entries)
			for (const day of entry.pattern.days) {
				const rows = byDay.get(day) ?? [];
				rows.push(entry);
				byDay.set(day, rows);
			}
		let consecutiveClasses = 0;
		for (const rows of byDay.values()) {
			rows.sort((a, b) => a.slot.startMinute - b.slot.startMinute);
			let consecutive = 0;
			let previousEnd = -1;
			for (const row of rows) {
				consecutive =
					previousEnd === row.slot.startMinute ? consecutive + 1 : 1;
				if (consecutive > 3) consecutiveClasses += 5;
				previousEnd = row.slot.endMinute;
			}
		}
		return {
			consecutiveClasses,
			concentratedDays: entries.length >= 3 && byDay.size === 1 ? 3 : 0,
		};
	};
	return {
		sections,
		slots,
		patterns,
		preferences,
		pairs,
		candidate,
		outsidePreferred,
		teacherScore,
	};
}

export function scoreRoutine(
	input: IRoutineGenerationInput,
	entries: IRoutineEntry[],
): IRoutineScore {
	return scoreWithContext(scoringContext(input), entries);
}

function scoreWithContext(
	context: ReturnType<typeof scoringContext>,
	entries: IRoutineEntry[],
): IRoutineScore {
	const byCourse = new Map<string, ICandidate[]>();
	const byTeacher = new Map<string, ICandidate[]>();
	const breakdown = {
		curriculumClashes: 0,
		outsidePreferred: 0,
		consecutiveClasses: 0,
		concentratedDays: 0,
	};
	for (const raw of entries) {
		const section = context.sections.get(raw.sectionId);
		if (!section) continue;
		const entry = context.candidate(raw);
		const course = byCourse.get(section.courseId) ?? [];
		course.push(entry);
		byCourse.set(section.courseId, course);
		if (section.facultyId) {
			const teacher = byTeacher.get(section.facultyId) ?? [];
			teacher.push(entry);
			byTeacher.set(section.facultyId, teacher);
			breakdown.outsidePreferred += context.outsidePreferred(section, entry);
		}
	}
	for (const [a, b] of context.pairs) {
		const left = byCourse.get(a);
		const right = byCourse.get(b);
		if (
			left?.length &&
			right?.length &&
			!left.some((entry) => right.some((other) => !classesClash(entry, other)))
		)
			breakdown.curriculumClashes += 50;
	}
	for (const entries of byTeacher.values()) {
		const result = context.teacherScore(entries);
		breakdown.consecutiveClasses += result.consecutiveClasses;
		breakdown.concentratedDays += result.concentratedDays;
	}
	return {
		total: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
		breakdown,
	};
}

export function generateRoutine(
	input: IRoutineGenerationInput,
	onProgress: (progress: number) => void = () => {},
) {
	const random = seededRandom(input.semesterId);
	const context = scoringContext(input);
	const candidates = new Map<string, ICandidate[]>();
	const placed = new Map<string, ICandidate>();
	const pinned = new Set(
		(input.pinnedEntries ?? []).map((entry) => entry.sectionId),
	);
	const roomOccupancy = new Map<string, Map<string, Set<string>>>();
	const teacherOccupancy = new Map<string, Map<string, Set<string>>>();
	const unplaced: { sectionId: string; reason: string }[] = [];
	onProgress(0);
	const orderedSections = [...input.sections].sort((a, b) =>
		a.id.localeCompare(b.id),
	);
	for (const section of orderedSections) {
		const rows: ICandidate[] = [];
		for (const pattern of [...input.dayPatterns].sort((a, b) =>
			a.id.localeCompare(b.id),
		)) {
			if (
				pattern.type !== section.type ||
				pattern.days.length !== (section.type === "LAB" ? 1 : 2) ||
				new Set(pattern.days).size !== pattern.days.length
			)
				continue;
			for (const slot of [...input.timeSlots].sort(
				(a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id),
			)) {
				if (
					!slot.isActive ||
					slot.type !== section.type ||
					slot.startMinute < 0 ||
					slot.endMinute > 1440 ||
					slot.startMinute >= slot.endMinute
				)
					continue;
				if (
					(context.preferences.get(section.facultyId ?? "") ?? []).some(
						(preference) => {
							const unavailable = context.slots.get(preference.timeSlotId);
							return (
								preference.kind === "UNAVAILABLE" &&
								pattern.days.includes(preference.day) &&
								unavailable &&
								overlaps(slot, unavailable)
							);
						},
					)
				)
					continue;
				for (const room of [...input.rooms].sort(
					(a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id),
				)) {
					if (
						!room.isActive ||
						room.capacity < section.capacity ||
						room.type !== (section.type === "LAB" ? "LAB" : "CLASSROOM")
					)
						continue;
					rows.push({
						sectionId: section.id,
						roomId: room.id,
						dayPatternId: pattern.id,
						timeSlotId: slot.id,
						pattern,
						slot,
					});
				}
			}
		}
		candidates.set(section.id, rows);
	}
	onProgress(10);
	const occupancyChange = (
		map: typeof roomOccupancy,
		resourceId: string,
		entry: ICandidate,
		add: boolean,
	) => {
		const days = map.get(resourceId) ?? new Map<string, Set<string>>();
		for (const day of entry.pattern.days) {
			const ids = days.get(day) ?? new Set<string>();
			if (add) ids.add(entry.sectionId);
			else ids.delete(entry.sectionId);
			days.set(day, ids);
		}
		map.set(resourceId, days);
	};
	const put = (entry: ICandidate) => {
		placed.set(entry.sectionId, entry);
		occupancyChange(roomOccupancy, entry.roomId, entry, true);
		const facultyId = context.sections.get(entry.sectionId)?.facultyId;
		if (facultyId) occupancyChange(teacherOccupancy, facultyId, entry, true);
	};
	const remove = (entry: ICandidate) => {
		placed.delete(entry.sectionId);
		occupancyChange(roomOccupancy, entry.roomId, entry, false);
		const facultyId = context.sections.get(entry.sectionId)?.facultyId;
		if (facultyId) occupancyChange(teacherOccupancy, facultyId, entry, false);
	};
	const blockers = (entry: ICandidate) => {
		const ids = new Set<string>();
		const facultyId = context.sections.get(entry.sectionId)?.facultyId;
		const resources = [
			roomOccupancy.get(entry.roomId),
			facultyId ? teacherOccupancy.get(facultyId) : undefined,
		];
		for (const days of resources)
			for (const day of entry.pattern.days)
				for (const id of days?.get(day) ?? []) {
					const other = placed.get(id);
					if (
						id !== entry.sectionId &&
						other &&
						overlaps(entry.slot, other.slot)
					)
						ids.add(id);
				}
		return ids;
	};
	const addedPenalty = (section: IGenerationSection, entry: ICandidate) => {
		let penalty = context.outsidePreferred(section, entry);
		const teacherEntries: ICandidate[] = [];
		const byCourse = new Map<string, ICandidate[]>();
		for (const other of placed.values()) {
			const otherSection = context.sections.get(other.sectionId);
			if (!otherSection) continue;
			if (section.facultyId && otherSection.facultyId === section.facultyId)
				teacherEntries.push(other);
			const rows = byCourse.get(otherSection.courseId) ?? [];
			rows.push(other);
			byCourse.set(otherSection.courseId, rows);
		}
		if (section.facultyId) {
			const before = context.teacherScore(teacherEntries);
			const after = context.teacherScore([...teacherEntries, entry]);
			penalty +=
				after.consecutiveClasses +
				after.concentratedDays -
				before.consecutiveClasses -
				before.concentratedDays;
		}
		for (const [a, b] of context.pairs) {
			if (a !== section.courseId && b !== section.courseId) continue;
			const others = byCourse.get(a === section.courseId ? b : a);
			if (!others?.length) continue;
			const sameCourse = byCourse.get(section.courseId) ?? [];
			const clashBefore =
				sameCourse.length > 0 &&
				!sameCourse.some((row) =>
					others.some((other) => !classesClash(row, other)),
				);
			const clashAfter = ![...sameCourse, entry].some((row) =>
				others.some((other) => !classesClash(row, other)),
			);
			penalty += (Number(clashAfter) - Number(clashBefore)) * 50;
		}
		return penalty;
	};
	const pinnedValidation = validateRoutine({
		...input,
		entries: input.pinnedEntries ?? [],
	});
	if (!pinnedValidation.ok)
		throw new Error(
			`Pinned entries violate hard rules: ${pinnedValidation.violations[0].message}`,
		);
	for (const entry of input.pinnedEntries ?? [])
		put({ ...context.candidate(entry), isPinned: true });
	const order = orderedSections
		.filter((section) => !pinned.has(section.id))
		.sort(
			(a, b) =>
				(candidates.get(a.id)?.length ?? 0) -
					(candidates.get(b.id)?.length ?? 0) ||
				Number(b.type === "LAB") - Number(a.type === "LAB") ||
				b.capacity - a.capacity ||
				a.id.localeCompare(b.id),
		);
	const waiting: IGenerationSection[] = [];
	let progress = 10;
	for (const [index, section] of order.entries()) {
		let best: ICandidate | undefined;
		let bestPenalty = Number.POSITIVE_INFINITY;
		for (const candidate of candidates.get(section.id) ?? []) {
			if (blockers(candidate).size) continue;
			const penalty = addedPenalty(section, candidate);
			if (penalty < bestPenalty) {
				best = candidate;
				bestPenalty = penalty;
			}
		}
		if (best) put(best);
		else waiting.push(section);
		const next =
			10 + Math.floor(((index + 1) / Math.max(order.length, 1)) * 5) * 10;
		if (next > progress) {
			progress = next;
			onProgress(progress);
		}
	}
	for (const section of waiting) {
		let repaired = false;
		for (const candidate of candidates.get(section.id) ?? []) {
			const blocked = [...blockers(candidate)];
			if (blocked.length !== 1 || pinned.has(blocked[0])) continue;
			const blocker = placed.get(blocked[0]);
			if (!blocker) continue;
			remove(blocker);
			put(candidate);
			const alternative = (candidates.get(blocker.sectionId) ?? []).find(
				(row) => !blockers(row).size,
			);
			if (alternative) {
				put(alternative);
				repaired = true;
				break;
			}
			remove(candidate);
			put(blocker);
		}
		if (!repaired)
			unplaced.push({
				sectionId: section.id,
				reason: `No ${section.type === "LAB" ? "LAB" : "CLASSROOM"} room with at least ${section.capacity} seats is free for ${section.label ?? section.id} while its teacher is available.`,
			});
	}
	onProgress(70);
	let score = scoreWithContext(context, [...placed.values()]);
	const movable = [...placed.keys()].filter((id) => !pinned.has(id));
	const improvementStarted = Date.now();
	for (
		let attempt = 0;
		attempt < 5000 &&
		score.total > 0 &&
		Date.now() - improvementStarted < 20000 &&
		movable.length;
		attempt++
	) {
		const id = movable[Math.floor(random() * movable.length)];
		const before = placed.get(id);
		if (!before) continue;
		if (random() < 0.5 && movable.length > 1) {
			const otherId = movable[Math.floor(random() * movable.length)];
			const other = placed.get(otherId);
			if (!other || id === otherId) continue;
			const a = (candidates.get(id) ?? []).find(
				(row) =>
					row.roomId === other.roomId &&
					row.dayPatternId === other.dayPatternId &&
					row.timeSlotId === other.timeSlotId,
			);
			const b = (candidates.get(otherId) ?? []).find(
				(row) =>
					row.roomId === before.roomId &&
					row.dayPatternId === before.dayPatternId &&
					row.timeSlotId === before.timeSlotId,
			);
			if (!a || !b) continue;
			remove(before);
			remove(other);
			if (blockers(a).size) {
				put(before);
				put(other);
				continue;
			}
			put(a);
			if (blockers(b).size) {
				remove(a);
				put(before);
				put(other);
				continue;
			}
			put(b);
			const next = scoreWithContext(context, [...placed.values()]);
			if (next.total < score.total) score = next;
			else {
				remove(a);
				remove(b);
				put(before);
				put(other);
			}
		} else {
			const options = candidates.get(id) ?? [];
			const candidate = options[Math.floor(random() * options.length)];
			if (!candidate || blockers(candidate).size) continue;
			remove(before);
			put(candidate);
			const next = scoreWithContext(context, [...placed.values()]);
			if (next.total < score.total) score = next;
			else {
				remove(candidate);
				put(before);
			}
		}
		if (attempt === 2500) onProgress(80);
	}
	onProgress(80);
	onProgress(90);
	const entries: IRoutineEntry[] = [...placed.values()]
		.sort((a, b) => a.sectionId.localeCompare(b.sectionId))
		.map(({ sectionId, roomId, dayPatternId, timeSlotId, isPinned }) => ({
			sectionId,
			roomId,
			dayPatternId,
			timeSlotId,
			isPinned: isPinned ?? false,
		}));
	const validation = validateRoutine({ ...input, entries });
	if (!validation.ok)
		throw new Error(
			`Generated routine violates hard rules: ${validation.violations[0].message}`,
		);
	return {
		entries,
		score: score.total,
		report: { unplaced, softRules: score.breakdown, validation },
	};
}
