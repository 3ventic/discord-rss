import type { RedisClientType } from "@redis/client";
import { createClient } from "redis";

class Storage {
	private redis: RedisClientType;
	constructor(redisUrl: string) {
		this.redis = createClient({
			url: redisUrl,
		});
		this.redis.connect();
		this.redis.on("error", (err) => {
			console.error("redis error", err);
		});
	}

	public async removeItem(key: string) {
		return await this.redis.del(key);
	}

	public async getString(key: string) {
		return await this.redis.get(key);
	}

	public async getItem<T>(key: string): Promise<T | null> {
		const value = await this.getString(key);
		if (value == null) {
			return null;
		}
		return JSON.parse(value);
	}

	public async setString(key: string, value: string) {
		return await this.redis.set(key, value);
	}

	public async setItem<T>(key: string, value: T) {
		return await this.setString(key, JSON.stringify(value));
	}
}

if (!process.env.REDIS_URL) {
	throw new Error("REDIS_URL env var is not defined");
}

let instance: Storage = new Storage(process.env.REDIS_URL);
export default instance;
