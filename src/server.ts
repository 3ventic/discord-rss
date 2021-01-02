import * as sapper from "@sapper/server";
import { json } from "body-parser";
import compression from "compression";
import express from "express";
import sirv from "sirv";
import { handleFeeds } from "./listener/listener";

const { PORT, NODE_ENV, INTERVAL } = process.env;
const dev = NODE_ENV === "development";

// const testItem: Item = {
//   pubDate: "Wed, 02 Dec 2020 05:16:24 +0000",
//   title: "one",
// };

// Storage.setItem("feeds", [
//   {
//     url: "https://status.twitch.tv/history.rss",
//     lastItem: testItem,
//     hookUrl:
//       "https://discord.com/api/webhooks/794682492032253952/9V9mkrpSmUw69TgER3Vws0ABDmwrUIwVzmscfZUZBGJHRlPTSzNhGuStrISSYXbGuY-X",
//     name: "Twitch is a derp",
//   },
// ]);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
setInterval(
  handleFeeds,
  (typeof INTERVAL === "undefined" ? 5 : parseInt(INTERVAL)) * MINUTE
);
handleFeeds();

express()
  .use(json())
  .use(
    compression({ threshold: 0 }),
    sirv("static", { dev }),
    sapper.middleware()
  )
  .listen(PORT);
