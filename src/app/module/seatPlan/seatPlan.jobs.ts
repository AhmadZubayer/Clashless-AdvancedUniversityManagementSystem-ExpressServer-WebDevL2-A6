import { queueEmail } from "../../jobs/email";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { minutesToTime } from "../../utils/time";

// Daily at 18:00 (Asia/Dhaka): email every student with an exam tomorrow.
export const sendExamSeatReminders = async () => {
	const tomorrow = new Date(Date.now() + 6 * 3600000 + 24 * 3600000)
		.toISOString()
		.slice(0, 10);
	const seats = await prisma.seatAssignment.findMany({
		where: {
			seatPlan: {
				status: "PUBLISHED",
				examSlot: { date: new Date(`${tomorrow}T00:00:00.000Z`) },
			},
		},
		include: {
			student: { select: { name: true, email: true } },
			room: { select: { roomNo: true } },
			offering: { select: { course: { select: { code: true } } } },
			seatPlan: { include: { examSlot: true } },
		},
	});
	let sent = 0;
	for (const seat of seats) {
		const slot = seat.seatPlan.examSlot;
		try {
			await queueEmail({
				to: seat.student.email,
				subject: "Exam tomorrow: your seat",
				templateName: "seat-plan-published",
				templateData: {
					name: seat.student.name,
					course: seat.offering.course.code,
					date: tomorrow,
					time: `${minutesToTime(slot.startMinute)}-${minutesToTime(slot.endMinute)}`,
					roomNo: seat.room.roomNo,
					column: seat.column,
					seatNo: seat.seatNo,
					changed: false,
				},
			});
			sent += 1;
		} catch (error) {
			logger.error({ err: error }, "Exam seat reminder could not be queued");
		}
	}
	return { sent };
};
