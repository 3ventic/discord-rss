import type { ServerResponse } from "http";
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

export async function get(req: Request, res: ServerResponse) {
	res.writeHead(200, {
		"Content-Type": "application/json",
	});

	res.end(
		JSON.stringify(
			((await Storage.getItem<Array<Feed>>(DBName)) ?? []).map((f) => {
				f.lastItem = undefined;
				return f;
			})
		)
	);
}

export async function post(req: Request, res: ServerResponse) {
	if (await Storage.getString(Processing)) {
		res.writeHead(503, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				message: "unable to save right now. Try again in a few seconds.",
			})
		);
		return;
	}

	let feeds: Feed[] = req.body;
	if (!valid(feeds)) {
		res.writeHead(400, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ message: "invalid feeds" }));
		return;
	}
	const oldFeeds: Feed[] = await Storage.getItem(DBName);
	for (let i = 0; i < feeds.length; i++) {
		for (let old of oldFeeds) {
			if (old.url === feeds[i].url) {
				feeds[i].lastItem = old.lastItem;
			}
		}
	}
	await Storage.setItem(DBName, feeds);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ message: "saved!" }));
}
