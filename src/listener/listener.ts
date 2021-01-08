import fetch from "node-fetch";
import Parser from "rss-parser";
import { DBName, Processing } from "../const";
import Storage from "../storage";
import type { DiscordEmbed, Feed } from "../types";

const parser = new Parser();

export const handleFeeds = async () => {
  await Storage.setItem(Processing, true);
  const feeds = (await Storage.getItem(DBName)) as Array<Feed>;
  for (let i = 0; i < feeds.length; i++) {
    console.log(feeds[i].name);
    const feed = await parser.parseURL(feeds[i].url);
    const items = feed.items
      .filter((item) => item.pubDate)
      .filter(
        (item) =>
          !feeds[i].lastItem ||
          new Date(item.pubDate!) > new Date(feeds[i].lastItem!.pubDate!)
      )
      .sort(
        (a, b) =>
          new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime()
      );
    if (items.length > 0) {
      feeds[i].lastItem = items[0];
      for (let item of items) {
        console.log(item.link);
        try {
          let embed: DiscordEmbed = {
            title: item.title,
            description: htmlToMarkdown(item.contentSnippet),
            url: item.link,
            timestamp: new Date(item.pubDate!).toISOString(),
            color: getColor(item.content),
          };
          if (feeds[i].imageUrl) {
            embed.thumbnail = {
              url: feeds[i].imageUrl,
            };
          }
          let result = await fetch(`${feeds[i].hookUrl}?wait=true`, {
            method: "post",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              allowed_mentions: [],
              embeds: [embed],
              username: feeds[i].name,
            }),
          });
          if (result.status !== 200) {
            throw new Error(
              `${item.link}: ${result.status} ${result.statusText}`
            );
          }
        } catch (e) {
          console.error("error posting webhook", e);
        }
      }
    }
  }
  await Storage.setItem(DBName, feeds);
  await Storage.removeItem(Processing);
};

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
