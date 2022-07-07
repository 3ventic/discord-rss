import type { GetSession, Handle } from "@sveltejs/kit";
import { appAuth } from "./lib/appAuth";
import type { AppSession } from "./types";

export const handle: Handle = async ({ event, resolve }) => {
	const { user } = (await appAuth.getSession(event)) as AppSession;
	event.locals["user"] = user;
	const response = await resolve(event);
	return response;
};

export const getSession: GetSession = async (event) => {
	return event.locals;
};
