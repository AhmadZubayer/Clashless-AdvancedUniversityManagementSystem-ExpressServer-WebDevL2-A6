import type {
	IExamEntryInput,
	IExamOffering,
	IExamSlotInput,
} from "./examRoutineValidator";

export interface IExamRoutineGenerationInput {
	offerings: IExamOffering[];
	slots: IExamSlotInput[];
	maxStudentsPerSlot: number;
}

export interface IExamRoutineReport {
	maxStudentsPerSlot: number;
	unplaced: { offeringId: string; label: string; blockedBy: string[] }[];
	threeExamDays: { studentId: string; date: string; exams: number }[];
	backToBack: number;
}

const THREE_EXAM_PENALTY = 10;
const BACK_TO_BACK_PENALTY = 3;

// Slots in date then time order; consecutive slots of one date are "back to back".
export const sortSlots = (slots: IExamSlotInput[]) =>
	[...slots].sort(
		(a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute,
	);

// Welsh-Powell colouring of the shared-student graph, with a soft penalty
// for 3+ exams a day and back-to-back exams.
export function generateExamRoutine(input: IExamRoutineGenerationInput) {
	const slots = sortSlots(input.slots);
	const slotIndex = new Map(slots.map((slot, index) => [slot.id, index]));
	const offeringById = new Map(input.offerings.map((row) => [row.id, row]));

	// 1. graph
	const byStudent = new Map<string, string[]>();
	for (const offering of input.offerings)
		for (const studentId of new Set(offering.studentIds))
			byStudent.set(studentId, [
				...(byStudent.get(studentId) ?? []),
				offering.id,
			]);
	const neighbours = new Map<string, Map<string, number>>(
		input.offerings.map((row) => [row.id, new Map()]),
	);
	for (const list of byStudent.values())
		for (let i = 0; i < list.length; i++)
			for (let j = i + 1; j < list.length; j++) {
				const a = neighbours.get(list[i]);
				const b = neighbours.get(list[j]);
				a?.set(list[j], (a.get(list[j]) ?? 0) + 1);
				b?.set(list[i], (b.get(list[i]) ?? 0) + 1);
			}

	// 2. order: edges then students, both descending (ties by id for determinism)
	const order = [...input.offerings].sort(
		(a, b) =>
			(neighbours.get(b.id)?.size ?? 0) - (neighbours.get(a.id)?.size ?? 0) ||
			new Set(b.studentIds).size - new Set(a.studentIds).size ||
			a.id.localeCompare(b.id),
	);

	// 3. placement
	const placed = new Map<string, string>(); // offeringId -> slotId
	const slotStudents = slots.map(() => 0);
	const studentSlots = new Map<string, Set<number>>();
	const unplaced: IExamRoutineReport["unplaced"] = [];
	for (const offering of order) {
		const students = [...new Set(offering.studentIds)];
		const blockedSlots = new Set<number>();
		const blockers = new Set<string>();
		for (const neighbourId of neighbours.get(offering.id)?.keys() ?? []) {
			const slotId = placed.get(neighbourId);
			if (slotId === undefined) continue;
			blockedSlots.add(slotIndex.get(slotId) as number);
			blockers.add(neighbourId);
		}
		let best = -1;
		let bestPenalty = Number.POSITIVE_INFINITY;
		for (let index = 0; index < slots.length; index++) {
			if (blockedSlots.has(index)) continue;
			if (slotStudents[index] + students.length > input.maxStudentsPerSlot)
				continue;
			let penalty = 0;
			for (const studentId of students) {
				const held = studentSlots.get(studentId);
				if (!held?.size) continue;
				const sameDay = [...held].filter(
					(other) => slots[other].date === slots[index].date,
				);
				if (sameDay.length >= 2) penalty += THREE_EXAM_PENALTY;
				if (
					sameDay.some((other) => Math.abs(other - index) === 1) // adjacent in order
				)
					penalty += BACK_TO_BACK_PENALTY;
			}
			if (penalty < bestPenalty) {
				best = index;
				bestPenalty = penalty;
			}
		}
		if (best < 0) {
			unplaced.push({
				offeringId: offering.id,
				label: offering.label,
				blockedBy: [...blockers],
			});
			continue;
		}
		placed.set(offering.id, slots[best].id);
		slotStudents[best] += students.length;
		for (const studentId of students)
			studentSlots.set(
				studentId,
				(studentSlots.get(studentId) ?? new Set()).add(best),
			);
	}

	const entries: IExamEntryInput[] = [...placed].map(
		([offeringId, examSlotId]) => ({ offeringId, examSlotId }),
	);
	return {
		entries,
		report: buildExamReport(
			input.maxStudentsPerSlot,
			slots,
			entries,
			offeringById,
			unplaced,
		),
	};
}

// 5. the report: unplaced courses, students with 3+ exams a day, back-to-back count.
export function buildExamReport(
	maxStudentsPerSlot: number,
	slots: IExamSlotInput[],
	entries: IExamEntryInput[],
	offeringById: Map<string, IExamOffering>,
	unplaced: IExamRoutineReport["unplaced"],
): IExamRoutineReport {
	const ordered = sortSlots(slots);
	const index = new Map(ordered.map((slot, position) => [slot.id, position]));
	const perStudent = new Map<string, number[]>();
	for (const entry of entries) {
		const position = index.get(entry.examSlotId);
		if (position === undefined) continue;
		for (const studentId of new Set(
			offeringById.get(entry.offeringId)?.studentIds ?? [],
		))
			perStudent.set(studentId, [
				...(perStudent.get(studentId) ?? []),
				position,
			]);
	}
	const threeExamDays: IExamRoutineReport["threeExamDays"] = [];
	let backToBack = 0;
	for (const [studentId, positions] of perStudent) {
		const days = new Map<string, number[]>();
		for (const position of positions)
			days.set(ordered[position].date, [
				...(days.get(ordered[position].date) ?? []),
				position,
			]);
		for (const [date, list] of days) {
			if (list.length >= 3)
				threeExamDays.push({ studentId, date, exams: list.length });
			const sorted = [...list].sort((a, b) => a - b);
			for (let i = 1; i < sorted.length; i++)
				if (sorted[i] - sorted[i - 1] === 1) backToBack += 1;
		}
	}
	return { maxStudentsPerSlot, unplaced, threeExamDays, backToBack };
}
