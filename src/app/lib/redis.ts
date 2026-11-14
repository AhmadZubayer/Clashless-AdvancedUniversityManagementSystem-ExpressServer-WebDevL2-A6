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
	},
});

redisClient.on("error", () => logger.error("Redis connection failed"));
