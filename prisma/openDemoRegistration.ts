import { Prisma } from "../src/generated/prisma/client";
import { generateRoutine } from "../src/app/engine/routineGenerator";
import { validateRoutine } from "../src/app/engine/routineValidator";
import { prisma } from "../src/app/lib/prisma";
import { routineService } from "../src/app/module/routine/routine.service";
import { semesterService } from "../src/app/module/semester/semester.service";

/** Explicit demo-only reopening; existing enrollments, payments and grades are retained. */
export async function openDemoRegistrationIntoDB(
	semesterId: string,
	actorId: string,
	batchId: string,
	now = new Date(),
) {
	const semester = await prisma.semester.findUniqueOrThrow({
		where: { id: semesterId },
	});
	if (!["PLANNING", "REGISTRATION"].includes(semester.phase))
		throw new Error(
			"Demo registration can only open from PLANNING or REGISTRATION",
		);
	const actor = await prisma.user.findUniqueOrThrow({
		where: { id: actorId },
		select: { id: true, name: true, email: true, role: true },
	});
	const input = await routineService.loadRoutineInputFromDB(prisma, semesterId);
	if (input.sections.some((section) => !section.facultyId))
		throw new Error("Every demo section needs a teacher");
	let routineId: string;
	if (semester.phase === "PLANNING") {
		const result = generateRoutine(input);
		if (result.report.unplaced.length || !result.report.validation.ok)
			throw new Error("Demo routine could not place every section");
		const routine = await prisma.$transaction(
			async (tx) => {
				const latest = await tx.routine.aggregate({
					where: { semesterId },
					_max: { version: true },
				});
				return tx.routine.create({
					data: {
						semesterId,
						version: (latest._max.version ?? 0) + 1,
						score: result.score,
						report: result.report as unknown as Prisma.InputJsonValue,
						entries: { createMany: { data: result.entries } },
					},
				});
			},
			{
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
				timeout: 15000,
			},
		);
		await routineService.publishRoutineIntoDB(routine.id);
		routineId = routine.id;
	} else {
		const published = await prisma.routine.findFirst({
			where: { semesterId, status: "PUBLISHED" },
			include: { entries: true },
		});
		if (!published) throw new Error("A published demo routine is required");
		const placed = new Set(published.entries.map((entry) => entry.sectionId));
		if (
			input.sections.some((section) => !placed.has(section.id)) ||
			!validateRoutine({ ...input, entries: published.entries }).ok
		)
			throw new Error(
				"Published demo routine no longer covers every section with valid placements",
			);
		routineId = published.id;
	}
	const endsAt = new Date(now.getTime() + 2 * 3600000);
	const paymentDeadline = new Date(
		endsAt.getTime() + semester.paymentDeadlineDays * 86400000,
	);
	const window = await prisma.$transaction(
		async (tx) => {
			const current = await tx.semester.findUniqueOrThrow({
				where: { id: semesterId },
				select: { phase: true },
			});
			if (!["PLANNING", "REGISTRATION"].includes(current.phase))
				throw new Error("Demo semester phase changed");
			const window = await tx.registrationWindow.upsert({
				where: { unique_batch_window: { semesterId, batchId } },
				create: { semesterId, batchId, startsAt: now, endsAt },
				update: { startsAt: now, endsAt },
			});
			await tx.semesterRegistration.updateMany({
				where: { semesterId, student: { batchId } },
				data: { paymentDeadline },
			});
			return window;
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
	if (semester.phase === "PLANNING")
		await semesterService.changeSemesterPhaseIntoDB(
			actor,
			semesterId,
			"REGISTRATION",
		);
	return { routineId, window };
}
