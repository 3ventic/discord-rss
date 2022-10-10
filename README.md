# Discord RSS Feed Manager

RSS and Atom feeds to Discord webhooks with web management UI.

## Usage

### Native

Install node 18+ and npm, and run `npm install`, `npm run sync`.
For the web interface run `npm run build` and `npm start`.
For the RSS poller run `npm run build:runner` and `npm run runner`.

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/2LnViG?referralCode=6hr3nf)

### Configuration

The service can be configured using environment variables:

- `PORT` (default 3000) port to listen on
- `INTERVAL` (default 5) minutes between checks
- `REDIS_URL` (required) redis connect url
- `DISCORD_CLIENT_ID` (required) https://discord.com/developers/applications
- `DISCORD_CLIENT_SECRET` (required) https://discord.com/developers/applications
- `DISCORD_AUTHORIZED_USERS` (required) comma-separated list of Discord user IDs for users allowed to access and modify the configuration

## Screenshots

![](https://meme.stream/fh/TangibleImmediatePartyTime-RSS_Settings__Firefox_Developer_Edition.png)
