import { randomUUID } from "node:crypto";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { expect, it } from "vitest";
import config from "../../src/app/config";

it("F0 broker integration processes a job through an isolated real Redis queue", async () => {
	const name = `integration-${randomUUID()}`;
	const prefix = `${config.redis_key_prefix}broker-check`;
	if (config.node_env !== "test" || !prefix.startsWith("clashless:test:"))
		throw new Error("Unsafe queue test prefix");
	const connection = new IORedis({
		host: config.redis_host,
		port: Number(config.redis_port),
		username: config.redis_user,
		password: config.redis_password,
		maxRetriesPerRequest: null,
		...(config.redis_tls ? { tls: {} } : {}),
	});
	const queue = new Queue(name, { connection, prefix });
	const worker = new Worker(name, async (job) => job.data.value, {
		connection,
		prefix,
		autorun: false,
		runRetryDelay: 5000,
	});
	let run: Promise<void> | undefined;
	try {
		const completed = new Promise<unknown>((resolve, reject) => {
			worker.on("completed", (_job, value) => resolve(value));
			worker.on("error", () =>
				reject(new Error("Isolated queue worker failed")),
			);
			worker.on("failed", () => reject(new Error("Isolated queue job failed")));
		});
		queue.on("error", () => {});
		await worker.waitUntilReady();
		run = worker.run();
		await queue.add("echo", { value: 42 }, { removeOnComplete: true });
		expect(await completed).toBe(42);
	} finally {
		await worker.close(true);
		await queue.close();
		await connection.quit();
		await run;
	}
});
