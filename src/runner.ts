import { Processing } from "./const.js";
import { handleFeeds } from "./listener/listener.js";
import Storage from "./storage.js";

const { INTERVAL } = process.env;

await Storage.removeItem(Processing);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
setInterval(
	handleFeeds,
	(typeof INTERVAL === "undefined" ? 5 : parseInt(INTERVAL)) * MINUTE
);
