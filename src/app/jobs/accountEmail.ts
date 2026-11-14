import { randomUUID } from "node:crypto";
import { z } from "zod";
import config from "../config";
import { enqueueJob, registerJobHandler } from "../lib/queue";
import { sendEmail } from "../utils/sendEmail";

const payloadSchema = z.object({
	to: z.email(),
	name: z.string(),
	email: z.email(),
	password: z.string().optional(),
});
registerJobHandler("account-email", async (data) => {
	const payload = payloadSchema.parse(data);
	await sendEmail({
		to: payload.to,
		subject: payload.password
			? `Welcome to ${config.app_name}`
			: `Activate your ${config.app_name} account`,
		templateName: payload.password ? "staff-welcome" : "student-invite",
		templateData: {
			name: payload.name,
			email: payload.email,
			...(payload.password ? { password: payload.password } : {}),
		},
	});
});

export const queueAccountEmail = (data: z.infer<typeof payloadSchema>) =>
	enqueueJob("account-email", data, randomUUID());
