import { Processing } from "./const";
import { handleFeeds } from "./listener/listener";
import Storage from "./storage";

const { INTERVAL } = process.env;

await Storage.removeItem(Processing);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
setInterval(
	handleFeeds,
	(typeof INTERVAL === "undefined" ? 5 : parseInt(INTERVAL)) * MINUTE
);
