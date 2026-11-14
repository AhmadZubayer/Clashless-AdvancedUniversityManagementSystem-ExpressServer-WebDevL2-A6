import config from "../config";
import { logger } from "./logger";
import { redisClient } from "./redis";

export interface ISeatEvent { sectionId: string; enrolledCount: number; capacity: number }
const channelFor = (semesterId: string) => `${config.node_env === "test" ? config.redis_key_prefix : ""}seats:${semesterId}`;

export const publishSeatEvent = (semesterId: string, event: ISeatEvent) => redisClient.publish(channelFor(semesterId), JSON.stringify(event));

export async function subscribeSeatEvents(semesterId: string, listener: (event: ISeatEvent) => void) {
	const subscriber = redisClient.duplicate();
	subscriber.on("error", () => logger.error("Seat event subscription connection failed"));
	await subscriber.connect();
	await subscriber.subscribe(channelFor(semesterId), (message) => {
		try { listener(JSON.parse(message)); } catch { logger.error("Invalid seat event received"); }
	});
	return async () => { await subscriber.unsubscribe(channelFor(semesterId)); await subscriber.quit(); };
}
