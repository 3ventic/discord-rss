import { URL } from "url";
import { DBName, Processing, WebhookUrlMaxLength } from "../const";
import Storage from "../storage";
import type { Feed } from "../types";

const valid: (feeds: Feed[]) => boolean = (feeds) => {
	let names = new Map<string, {}>();
	for (let feed of feeds) {
		let acceptedKeys = 0;
		try {
			// required URLs
			new URL(feed.url);
			new URL(feed.hookUrl);
			if (feed.hookUrl.length > WebhookUrlMaxLength) {
				return false;
			}
			acceptedKeys += 2;
		} catch (e) {
			return false;
		}
		try {
			// optional URLs
			new URL(feed.imageUrl);
			acceptedKeys++;
		} catch (e) {
			console.log(e);
			if (feed.imageUrl === "") {
				acceptedKeys++;
			}
		}
		if (names.has(feed.name)) {
			return false;
		} else {
			names.set(feed.name, Object.create(null));
			acceptedKeys++;
		}
		// ensure no unknown keys made their way in
		if (Object.keys(feed).length > acceptedKeys) {
			return false;
		}
	}
	return true;
};

export async function post({ request }) {
	if (await Storage.getString(Processing)) {
		return {
			status: 503,
			body: {
				message: "unable to save right now. Try again in a few seconds.",
			},
		};
	}

	let feeds: Array<Feed> = await request.json();
	console.error(feeds);
	if (!valid(feeds)) {
		return {
			status: 400,
			body: { message: "invalid feeds" },
		};
	}
	const oldFeeds = (await Storage.getItem<Array<Feed>>(DBName)) ?? [];
	for (let i = 0; i < feeds.length; i++) {
		for (let old of oldFeeds) {
			if (old.url === feeds[i].url) {
				feeds[i].lastItem = old.lastItem;
			}
		}
	}
	await Storage.setItem(DBName, feeds);

	return {
		headers: {
			"Content-Type": "application/json",
		},
		body: { message: "saved!" },
	};
}
