import fetch from "node-fetch";
import Parser from "rss-parser";
import { DBName, Processing } from "../const";
import Storage from "../storage";
import type { DiscordEmbed, Feed } from "../types";

const parser = new Parser();

export const handleFeeds = async () => {
	if (await Storage.getString(Processing)) {
		console.log("still processing, skipping");
		return;
	}
	console.log("starting processing");
	await Storage.setString(Processing, "1");
	try {
		const feeds = await Storage.getItem<Array<Feed>>(DBName);
		if (feeds == null) {
			console.log("no feeds found");
			return;
		}
		for (let i = 0; i < feeds.length; i++) {
			console.log("feed:", feeds[i].name);
			if (!feeds[i].lastItem) {
				feeds[i].lastItem = { isoDate: new Date().toISOString() };
				console.log("new feed, skipping");
				continue;
			}
			const feed = await parser.parseURL(feeds[i].url);
			const items = feed.items
				.filter((item) => item.isoDate)
				.filter(
					(item) =>
						!feeds[i].lastItem ||
						new Date(item.isoDate!) > new Date(feeds[i].lastItem!.isoDate!)
				)
				.sort(
					(a, b) =>
						new Date(b.isoDate!).getTime() - new Date(a.isoDate!).getTime()
				);
			console.log("previous item:", feeds[i].lastItem);
			console.log("items:", items);
			if (items.length > 0) {
				feeds[i].lastItem = { isoDate: items[0].isoDate! };
				let embeds: DiscordEmbed[] = [];
				for (let item of items) {
					console.log(item.link);
					try {
						let embed: DiscordEmbed = {
							title: item.title,
							description: htmlToMarkdown(item.contentSnippet),
							url: item.link,
							timestamp: new Date(item.isoDate!).toISOString(),
							color: getColor(item.content),
						};
						if (feeds[i].imageUrl) {
							embed.thumbnail = {
								url: feeds[i].imageUrl,
							};
						}
						embeds.push(embed);
						if (embeds.length === 10) {
							await executeHook(feeds[i], embeds);
							embeds = [];
						}
					} catch (e) {
						console.error("error posting webhook", e);
					}
				}
				if (embeds.length > 0) {
					try {
						await executeHook(feeds[i], embeds);
					} catch (e) {
						console.error("error posting webhook", e);
					}
				}
			}
		}
		await Storage.setItem(DBName, feeds);
	} catch (e) {
		console.error("error processing", e);
	} finally {
		await Storage.removeItem(Processing);
		console.log("ended processing");
	}
};

async function executeHook(feed: Feed, embeds: DiscordEmbed[]) {
	let result = await fetch(`${feed.hookUrl}?wait=true`, {
		method: "post",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			allowed_mentions: [],
			embeds: embeds,
			username: feed.name,
		}),
	});
	if (result.status !== 200) {
		throw new Error(`${embeds[0].url}: ${result.status} ${result.statusText}`);
	}
}

function getColor(content: string | undefined): number {
	if (typeof content === "undefined") {
		return 0x0; // black
	}
	const c = content.toLowerCase();
	if (c.indexOf("resolved") !== -1) {
		return 0x69ffc3; // green
	}
	return 0xffca5f; // yellow
}

function htmlToMarkdown(content: string | undefined): string {
	if (typeof content === "undefined") {
		return "";
	}

	return content
		.replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
		.replace(/<small>(.*?)<\/small>/gi, "_$1_");
}
