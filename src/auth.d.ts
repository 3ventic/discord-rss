import type { User } from "sk-auth";

export interface AppSession extends App.Session {
	user: User | null;
}
