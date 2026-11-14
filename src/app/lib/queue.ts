import { Queue, Worker } from "bullmq";
import IORedis, { type RedisOptions } from "ioredis";
import config from "../config";
import { logger } from "./logger";

export type JobHandler = (data: Record<string, unknown>) => Promise<unknown>;
const handlers = new Map<string, JobHandler>();
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const connections = new Set<IORedis>();
const connectionOptions: RedisOptions = {
	host: config.redis_host,
	port: Number(config.redis_port),
	username: config.redis_user,
	password: config.redis_password,
	maxRetriesPerRequest: null,
	lazyConnect: true,
	connectTimeout: 10000,
	retryStrategy: (attempt) => Math.min(attempt * 100, 2000),
	...(config.redis_tls ? { tls: {} } : {}),
};
const prefix = `${config.redis_key_prefix}jobs`;

const errorLogger = (name: string) => {
	let lastLog = 0;
	return () => {
		if (Date.now() - lastLog >= 5000) {
			lastLog = Date.now();
			logger.error({ queue: name }, "Queue connection failed");
		}
	};
};
const createConnection = (name: string) => {
	// BullMQ's optional dynamic adapter loader cannot resolve ioredis in native ESM.
	// Supplying the constructed client also makes ownership and shutdown explicit.
	const client = new IORedis(connectionOptions);
	client.on("error", errorLogger(name));
	connections.add(client);
	return client;
};

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
	// Tests and Vercel have no worker process, so the job runs inline.
	if (config.node_env === "test" || process.env.VERCEL) {
		await handler(data);
		return { id: jobId };
	}
	let queue = queues.get(name);
	if (!queue) {
		queue = new Queue(name, { connection: createConnection(name), prefix });
		queue.on("error", errorLogger(name));
		queues.set(name, queue);
	}
	const job = await queue.add(name, data, {
		jobId,
		removeOnComplete: name === "account-email" || name === "email" ? true : 100,
		removeOnFail: name === "account-email" || name === "email" ? true : 100,
		attempts: name === "account-email" || name === "email" ? 3 : 1,
		backoff: { type: "exponential", delay: 1000 },
	});
	return { id: job.id ?? jobId };
}

export async function startQueueWorkers(names?: readonly string[]) {
	if (config.node_env === "test") return;
	for (const [name, handler] of handlers) {
		if (names && !names.includes(name)) continue;
		if (!workers.has(name)) {
			const worker = new Worker(name, (job) => handler(job.data), {
				connection: createConnection(name),
				prefix,
				autorun: false,
				runRetryDelay: 5000,
			});
			worker.on("error", errorLogger(name));
			worker.on("failed", () =>
				logger.error({ queue: name }, "Background job failed"),
			);
			workers.set(name, worker);
			await worker.waitUntilReady();
			void worker
				.run()
				.catch(() => logger.error({ queue: name }, "Worker stopped"));
		}
	}
}

export async function closeQueues() {
	await Promise.all([...workers.values()].map((worker) => worker.close()));
	await Promise.all([...queues.values()].map((queue) => queue.close()));
	await Promise.all(
		[...connections].map((client) =>
			client.status === "end"
				? undefined
				: client.quit().catch(() => client.disconnect()),
		),
	);
	workers.clear();
	queues.clear();
	connections.clear();
}
