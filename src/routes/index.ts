import { DBName } from "../const";
import Storage from "../storage";
import type { Feed } from "../types";

export async function get() {
	const ret = {
		headers: {
			"Content-Type": "application/json",
		},
		body: {
			feeds: ((await Storage.getItem<Array<Feed>>(DBName)) ?? []).map((f) => {
				f.lastItem = undefined;
				return f;
			}),
		},
	};
	console.log(ret);
	return ret;
}
