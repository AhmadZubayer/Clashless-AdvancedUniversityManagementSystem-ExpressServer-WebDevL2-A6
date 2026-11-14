import { randomUUID } from "node:crypto";
import { z } from "zod";
import { enqueueJob, registerJobHandler } from "../lib/queue";
import { sendEmail } from "../utils/sendEmail";

const payloadSchema = z.object({
	to: z.string(),
	subject: z.string(),
	templateName: z.string(),
	templateData: z.record(z.string(), z.unknown()).optional(),
});

// Bulk email queue: 3 retries with backoff (see lib/queue.ts).
registerJobHandler("email", async (data) => {
	await sendEmail(payloadSchema.parse(data));
});

export const queueEmail = (data: z.infer<typeof payloadSchema>) =>
	enqueueJob("email", data, randomUUID());
