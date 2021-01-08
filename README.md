# SapDiscoRSS

RSS to Discord webhooks with web management UI.

![](https://i.3v.fi/discorss-ss.png)

## Usage

### Docker

Pull and run from the docker image from the GitHub repository. Mount /tmp/appdata for persistence.

### Native

Install node 14+ and npm, and run `npm install`, `npm run build`, and `npm run start`

### Configuration

The service can be configured using environment variables. Update interval can be configured in minutes by setting `INTERVAL` (default 5). If reverse proxying to a subfolder, set `BASE_PATH`. Port can be changed by setting `PORT`.

## Security

It is important to either use a reverse proxy with auth or limit access to localhost only. The application itself does not currently have any access control built-in.
