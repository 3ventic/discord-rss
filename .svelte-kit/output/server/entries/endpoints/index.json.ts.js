import { URL } from "url";
import { createClient } from "redis";
const DBName = "feeds";
const Processing = "processing";
const WebhookUrlMaxLength = 300;
class Storage {
  constructor(redisUrl) {
    this.redis = createClient({
      url: redisUrl
    });
  }
  async removeItem(key) {
    return await this.redis.del(key);
  }
  async getString(key) {
    return await this.redis.get(key);
  }
  async getItem(key) {
    const value = await this.getString(key);
    if (value == null) {
      return null;
    }
    return JSON.parse(value);
  }
  async setString(key, value) {
    return await this.redis.set(key, value);
  }
  async setItem(key, value) {
    return await this.setString(key, JSON.stringify(value));
  }
}
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL env var is not defined");
}
let instance = new Storage(process.env.REDIS_URL);
const valid = (feeds) => {
  let names = /* @__PURE__ */ new Map();
  for (let feed of feeds) {
    let acceptedKeys = 0;
    try {
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
      names.set(feed.name, /* @__PURE__ */ Object.create(null));
      acceptedKeys++;
    }
    if (Object.keys(feed).length > acceptedKeys) {
      return false;
    }
  }
  return true;
};
async function get(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify((await instance.getItem(DBName)).map((f) => {
    f.lastItem = void 0;
    return f;
  })));
}
async function post(req, res) {
  if (await instance.getItem(Processing)) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      message: "unable to save right now. Try again in a few seconds."
    }));
    return;
  }
  let feeds = req.body;
  if (!valid(feeds)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "invalid feeds" }));
    return;
  }
  const oldFeeds = await instance.getItem(DBName);
  for (let i = 0; i < feeds.length; i++) {
    for (let old of oldFeeds) {
      if (old.url === feeds[i].url) {
        feeds[i].lastItem = old.lastItem;
      }
    }
  }
  await instance.setItem(DBName, feeds);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "saved!" }));
}
export { get, post };
