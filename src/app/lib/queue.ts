import { Queue, Worker, type ConnectionOptions } from "bullmq";
import config from "../config";

export type JobHandler = (data: Record<string, unknown>) => Promise<unknown>;
const handlers = new Map<string, JobHandler>();
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const connection: ConnectionOptions = {
	host: config.redis_host,
	port: Number(config.redis_port),
	username: config.redis_user,
	password: config.redis_password,
	maxRetriesPerRequest: null,
	...(config.redis_tls ? { tls: {} } : {}),
};
const prefix = `${config.redis_key_prefix}jobs`;

export function registerJobHandler(name: string, handler: JobHandler) {
	if (handlers.has(name))
		throw new Error(`Handler already registered: ${name}`);
	handlers.set(name, handler);
}

export async function enqueueJob(
	name: string,
	data: Record<string, unknown>,
	jobId: string,
) {
	const handler = handlers.get(name);
	if (!handler) throw new Error(`No handler registered: ${name}`);
	if (config.node_env === "test") {
		await handler(data);
		return { id: jobId };
	}
	let queue = queues.get(name);
	if (!queue) {
		queue = new Queue(name, { connection, prefix });
		queues.set(name, queue);
	}
	const job = await queue.add(name, data, {
		jobId,
		removeOnComplete: name === "account-email" ? true : 100,
		removeOnFail: name === "account-email" ? true : 100,
		attempts: name === "account-email" ? 3 : 1,
		backoff: { type: "exponential", delay: 1000 },
	});
	return { id: job.id ?? jobId };
}

export function startQueueWorkers() {
	if (config.node_env === "test") return;
	for (const [name, handler] of handlers) {
		if (!workers.has(name))
			workers.set(
				name,
				new Worker(name, (job) => handler(job.data), { connection, prefix }),
			);
	}
}

export async function closeQueues() {
	await Promise.all([...workers.values()].map((worker) => worker.close()));
	await Promise.all([...queues.values()].map((queue) => queue.close()));
	workers.clear();
	queues.clear();
}
