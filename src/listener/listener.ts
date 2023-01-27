import { RequestQuote16 } from "carbon-icons-svelte";
import fetch from "node-fetch";
import Parser from "rss-parser";
import { DBName, Processing } from "../const.js";
import Storage from "../storage.js";
import type { DiscordEmbed, Feed } from "../types.js";

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
			if (!feeds[i].lastItem?.isoDate) {
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
							title: truncateString(item.title ?? "", 250),
							description: htmlToMarkdown(
								truncateString(item.contentSnippet ?? "", 4000)
							),
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

function truncateString(str: string, to: number) {
	return str.length > to ? str.substring(0, to) + "..." : str;
}

async function executeHook(feed: Feed, embeds: DiscordEmbed[]) {
	let username: any = feed.name;
	let payload = {
		allowed_mentions: [],
		content: feed.name,
		embeds: embeds,
		username: username
	};

	if (process.env.SIMPLE) {
		payload.content = `**${feed.name}**\n${embeds[0].title}\n${embeds[0].url}`;
		payload.embeds = [];
		delete payload['username'];
	}

	async function response(url = '', data = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "Content-type": "application/json;"
        },
        body: JSON.stringify(data)
    });
    
    return response.json();
}

	response(`${feed.hookUrl}?wait=true`, payload )
		.then(json => {
			console.log(json) // Handle success
		})
		.catch(err => {
			console.log(err) // Handle errors
		});
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
