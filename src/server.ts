import * as sapper from "@sapper/server";
import { json } from "body-parser";
import compression from "compression";
import express from "express";
import sirv from "sirv";
import { Processing } from "./const";
import { handleFeeds } from "./listener/listener";
import Storage from "./storage";

const { PORT, NODE_ENV, INTERVAL, BASE_PATH } = process.env;
const dev = NODE_ENV === "development";

Storage.removeItem(Processing);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
setInterval(
  handleFeeds,
  (typeof INTERVAL === "undefined" ? 5 : parseInt(INTERVAL)) * MINUTE
);

express()
  .use(json())
  .use(
    BASE_PATH || "",
    compression({ threshold: 0 }),
    sirv("static", { dev }),
    sapper.middleware()
  )
  .listen(PORT);
