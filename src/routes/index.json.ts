import type { Request } from "express";
import type { ServerResponse } from "http";
import { DBName, Processing } from "../const";
import Storage from "../storage";
import type { Feed } from "../types";

export async function get(req: Request, res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify(await Storage.getItem(DBName)));
}

export async function post(req: Request, res: ServerResponse) {
  if (await Storage.getItem(Processing)) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "unable to save right now. Try again in a few seconds.",
      })
    );
    return;
  }

  let feeds: Feed[] = req.body;
  if (
    feeds.filter(
      (feed) =>
        feed.hookUrl && feed.name && feed.url && Object.keys(feed).length <= 4
    ).length !== feeds.length
  ) {
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
