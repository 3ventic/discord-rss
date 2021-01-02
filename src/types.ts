import type { Item } from "rss-parser";

export type Feed = {
  url: string;
  lastItem: Item;
  hookUrl: string;
  name: string;
};
