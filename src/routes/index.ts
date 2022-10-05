import { DBName } from "../const";
import Storage from "../storage";
import type { Feed } from "../types";

export async function get({ locals }) {
	let feed: Feed[] = [];
	if (locals.user?.isAuthorized) {
		feed = (await Storage.getItem<Feed[]>(DBName)) ?? [];
	}
	return {
		headers: {
			"Content-Type": "application/json",
		},
		body: {
			feeds: feed.map((f) => {
				f.lastItem = { isoDate: f.lastItem.isoDate };
				return f;
			}),
		},
	};
}
