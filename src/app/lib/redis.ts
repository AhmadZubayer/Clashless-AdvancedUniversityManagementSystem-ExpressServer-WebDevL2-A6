import { createClient } from "redis";
import config from "../config";
import { logger } from "./logger";

export const redisKey = (key: string) => `${config.redis_key_prefix}${key}`;

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
		...(config.redis_tls ? { tls: true as const } : {}),
		connectTimeout: 10000,
		reconnectStrategy:
			config.node_env === "test"
				? false
				: (retries) =>
						retries >= 5
							? new Error("Redis reconnect limit reached")
							: Math.min(100 * (retries + 1), 2000),
	},
});

redisClient.on("error", () => logger.error("Redis connection failed"));
