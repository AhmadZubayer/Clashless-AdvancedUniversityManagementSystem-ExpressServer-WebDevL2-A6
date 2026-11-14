export interface IExamOffering {
	id: string;
	label: string;
	studentIds: string[];
}

export interface IExamSlotInput {
	id: string;
	date: string; // YYYY-MM-DD
	startMinute: number;
	endMinute: number;
}

export interface IExamEntryInput {
	offeringId: string;
	examSlotId: string;
}

export interface IExamRoutineValidationInput {
	offerings: IExamOffering[];
	slots: IExamSlotInput[];
	entries: IExamEntryInput[];
	maxStudentsPerSlot?: number;
}

export type ExamViolation =
	| {
			type: "STUDENT_CLASH";
			examSlotId: string;
			offeringIds: string[];
			studentIds: string[];
	  }
	| { type: "UNPLACED"; offeringId: string; label: string }
	| { type: "SLOT_OVER_CAPACITY"; examSlotId: string; students: number }
	| { type: "UNKNOWN_SLOT"; offeringId: string };

// Hard rules: no student has two exams in one slot, every course is placed,
// and (when a limit is given) no slot holds more students than it has seats.
export function validateExamRoutine(input: IExamRoutineValidationInput) {
	const violations: ExamViolation[] = [];
	const slotIds = new Set(input.slots.map((slot) => slot.id));
	const offeringById = new Map(input.offerings.map((row) => [row.id, row]));
	const placed = new Map<string, string>();
	for (const entry of input.entries) {
		if (!slotIds.has(entry.examSlotId)) {
			violations.push({ type: "UNKNOWN_SLOT", offeringId: entry.offeringId });
			continue;
		}
		placed.set(entry.offeringId, entry.examSlotId);
	}
	for (const offering of input.offerings)
		if (!placed.has(offering.id))
			violations.push({
				type: "UNPLACED",
				offeringId: offering.id,
				label: offering.label,
			});

	const bySlot = new Map<string, string[]>();
	for (const [offeringId, slotId] of placed) {
		if (!offeringById.has(offeringId)) continue;
		bySlot.set(slotId, [...(bySlot.get(slotId) ?? []), offeringId]);
	}
	for (const [examSlotId, offeringIds] of bySlot) {
		const seen = new Map<string, string[]>();
		let students = 0;
		for (const offeringId of offeringIds)
			for (const studentId of offeringById.get(offeringId)?.studentIds ?? []) {
				students += 1;
				seen.set(studentId, [...(seen.get(studentId) ?? []), offeringId]);
			}
		const clashing = [...seen].filter(([, list]) => list.length > 1);
		if (clashing.length)
			violations.push({
				type: "STUDENT_CLASH",
				examSlotId,
				offeringIds: [...new Set(clashing.flatMap(([, list]) => list))],
				studentIds: clashing.map(([studentId]) => studentId),
			});
		if (input.maxStudentsPerSlot && students > input.maxStudentsPerSlot)
			violations.push({ type: "SLOT_OVER_CAPACITY", examSlotId, students });
	}
	return { ok: violations.length === 0, violations };
}
