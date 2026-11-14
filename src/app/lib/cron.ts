import cron from "node-cron";
import {
	discardUnpaidRegistrations,
	sendPaymentReminders,
	settleAbandonedPayments,
} from "../module/payment/payment.jobs";
import { sendExamSeatReminders } from "../module/seatPlan/seatPlan.jobs";
import { logger } from "./logger";

const schedule = (
	name: string,
	expression: string,
	job: () => Promise<unknown>,
) =>
	cron.schedule(
		expression,
		async () => {
			try {
				const result = await job();
				logger.info({ result }, `Cron: ${name} finished`);
			} catch (error) {
				logger.error({ err: error }, `Cron: ${name} failed`);
			}
		},
		{ timezone: "Asia/Dhaka" },
	);

export const startCronJobs = () => {
	schedule(
		"discard unpaid registrations",
		"0 * * * *",
		discardUnpaidRegistrations,
	);
	schedule("payment reminders", "0 10 * * *", sendPaymentReminders);
	schedule("abandoned payments", "*/15 * * * *", settleAbandonedPayments);
	schedule("exam seat reminders", "0 18 * * *", sendExamSeatReminders);
	logger.info("Cron jobs scheduled");
};
