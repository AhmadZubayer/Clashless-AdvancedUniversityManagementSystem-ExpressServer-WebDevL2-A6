import { afterAll, beforeAll } from "vitest";
import config from "../../src/app/config";
import { closeQueues } from "../../src/app/lib/queue";
import { prisma } from "../../src/app/lib/prisma";
import { redisClient } from "../../src/app/lib/redis";
import "../helpers/mocks";

beforeAll(async () => {
	if (config.database_schema !== "clashless_test")
		throw new Error("Refusing to truncate development data");
	const rows = await prisma.$queryRaw<
		{ tablename: string }[]
	>`SELECT tablename FROM pg_tables WHERE schemaname = 'clashless_test' AND tablename <> '_prisma_migrations'`;
	if (rows.length) {
		const names = rows
			.map((row) => `"clashless_test"."${row.tablename.replaceAll('"', '""')}"`)
			.join(", ");
		await prisma.$executeRawUnsafe(
			`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
		);
	}
	await redisClient.connect();
});

afterAll(async () => {
	await closeQueues();
	if (redisClient.isOpen) await redisClient.quit();
	await prisma.$disconnect();
});
