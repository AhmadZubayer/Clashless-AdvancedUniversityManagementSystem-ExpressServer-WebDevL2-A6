import { execFileSync } from "node:child_process";
import config from "../../src/app/config";
import { prisma } from "../../src/app/lib/prisma";
import { redisClient } from "../../src/app/lib/redis";

export default async function globalSetup() {
	if (
		config.node_env !== "test" ||
		config.database_schema !== "clashless_test" ||
		config.redis_key_prefix !== "clashless:test:"
	)
		throw new Error(
			"Refusing to initialize tests outside isolated schema and Redis prefix",
		);
	// Never reset the supplied development database. Apply migrations to the test schema only.
	// Hosted PostgreSQL occasionally rejects the schema-engine's first connection.
	// Deploy is idempotent; retry setup without exposing CLI connection diagnostics.
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			execFileSync(
				process.execPath,
				["node_modules/prisma/build/index.js", "migrate", "deploy"],
				{ stdio: "pipe", timeout: 120000 },
			);
			break;
		} catch {
			if (attempt === 3)
				throw new Error(
					"Test schema migration failed after three attempts; check database availability",
				);
			await new Promise((resolve) => setTimeout(resolve, attempt * 500));
		}
	}
	try {
		await redisClient.connect();
		for await (const keys of redisClient.scanIterator({
			MATCH: `${config.redis_key_prefix}*`,
			COUNT: 100,
		})) {
			if (keys.length) await redisClient.del(keys);
		}
	} catch {
		throw new Error(
			"Test Redis connection failed; check the configured host and credentials",
		);
	} finally {
		if (redisClient.isReady) await redisClient.quit();
		else if (redisClient.isOpen) redisClient.destroy();
		await prisma.$disconnect();
	}
}
