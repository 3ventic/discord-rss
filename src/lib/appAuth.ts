import { SvelteKitAuth } from "sk-auth";
import type { OAuth2ProviderConfig } from "sk-auth/dist/providers/oauth2";
import type { OAuth2Tokens } from "sk-auth/dist/providers/oauth2.base";
import { OAuth2Provider } from "sk-auth/providers";

export const appAuth = new SvelteKitAuth({
	providers: [
		new OAuth2Provider<any, OAuth2Tokens, OAuth2ProviderConfig>({
			accessTokenUrl: "https://discord.com/api/oauth2/token",
			authorizationUrl: "https://discord.com/api/oauth2/authorize",
			clientId: process.env.DISCORD_CLIENT_ID,
			clientSecret: process.env.DISCORD_CLIENT_SECRET,
			scope: "identify",
			id: "discord",
			profile: (profile, tokens) => {
				return {
					...profile,
					provider: "discord",
					isAuthorized: process.env.DISCORD_AUTHORIZED_USERS?.split(
						","
					).includes(profile.id),
				};
			},
			profileUrl: "https://discord.com/api/users/@me",
			contentType: "application/x-www-form-urlencoded",
		}),
	],
});
