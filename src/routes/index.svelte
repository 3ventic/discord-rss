<script context="module" lang="ts">
	export async function preload() {
		const res = await this.fetch(`index.json`);
		const data = await res.json();

		if (res.status === 200) {
			return { feeds: data };
		} else {
			this.error(res.status, data.message);
		}
	}
</script>

<script lang="ts">
	import type { DiscordEmbed, Feed } from "../types";

	export let feeds: Feed[];
	$: fds = feeds;
	$: saving = false;
	$: status = "";
	$: testing = false;

	const save = async () => {
		saving = true;
		status = `Saving...`;
		try {
			let result = await fetch(`index.json`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(fds),
			});
			let json = await result.json();
			status = `${result.statusText}: ${json.message || ""}`;
		} catch (e) {
			console.error(e);
			status = `Error. See browser console for details.`;
		}
	};

	const add = () => {
		fds = [
			...fds,
			{
				hookUrl: "",
				name: "",
				url: "",
				imageUrl: "",
			},
		];
	};

	const testHook = async (feed: Feed) => {
		testing = true;
		let embed: DiscordEmbed = {
			title: feed.name,
			color: 0x0,
			description: "Test description",
			url: "https://github.com/3ventic/discord-rss",
			thumbnail: {
				url: feed.imageUrl || undefined,
			},
			timestamp: new Date().toISOString(),
		};
		await fetch(`${feed.hookUrl}?wait=true`, {
			method: "post",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				allowed_mentions: [],
				embeds: [embed],
				username: feed.name,
			}),
		});
		testing = false;
	};
</script>

<style>
	input {
		background: rgb(7, 37, 85);
		color: rgb(202, 202, 202);
		padding: 0.3em;
		border: 1px solid rgb(45, 67, 105);
		margin: 0.2em;
		border-radius: 0.2em;
	}
	button {
		background: rgb(10, 17, 29);
		border: 1px solid rgb(45, 67, 105);
		color: rgb(202, 202, 202);
		border-radius: 0.2em;
	}
	button.delete {
		background: rgb(63, 7, 7);
	}
	button:hover {
		background: rgb(7, 37, 85);
	}
	button:disabled {
		opacity: 0.5;
	}
	.main {
		display: flex;
		flex-direction: column;
		width: auto;
		align-items: center;
	}
	.feedwrap:first {
		border-top: 2px solid rgb(45, 67, 105);
	}
	.feedwrap {
		display: flex;
		flex-direction: column;
		flex-wrap: nowrap;
		width: 50em;
		border-bottom: 2px solid rgb(45, 67, 105);
		margin-bottom: 1em;
		padding: 1em;
		line-height: 2em;
	}
	.feed {
		display: flex;
	}
	.feed > label {
		width: 14em;
	}
	.feed > input {
		flex-grow: 5;
	}
	.feedhead {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		margin-bottom: 0.8em;
		align-items: center;
	}
	.thumbnail {
		max-height: 2em;
		max-width: 5em;
	}
	.hidden {
		display: none;
	}
</style>

<svelte:head>
	<title>RSS Settings</title>
</svelte:head>

<div class="main">
	<div>
		<h1>Discord RSS Feed Manager</h1>
	</div>
	{#each fds as feed, i}
		<div class="feedwrap">
			<div class="feedhead">
				<strong>#{i + 1}: {feed.name}</strong>
				<button
					class="delete"
					on:click={() => {
						fds = fds.splice(i, 1);
						fds = fds; // workaround to a render update bug
					}}>X</button>
			</div>
			<div class="feed">
				<label for="name">Title</label>
				<input id="name" type="text" bind:value={feed.name} />
			</div>
			<div class="feed">
				<label for="url">Atom/RSS URL</label>
				<input id="url" type="url" bind:value={feed.url} />
			</div>
			<div class="feed">
				<label for="hookurl">Discord Webhook URL</label>
				<input id="hookurl" type="url" bind:value={feed.hookUrl} />
				<button on:click={() => testHook(feed)} disabled={testing}>Test</button>
			</div>
			<div class="feed">
				<label for="thumbnailurl">Thumbnail URL</label>
				<input id="thumbnailurl" type="url" bind:value={feed.imageUrl} />
				<img
					src={feed.imageUrl}
					alt="thumbnail"
					class={`thumbnail ${feed.imageUrl ? '' : 'hidden'}`} />
			</div>
		</div>
	{/each}
	<div>
		<button on:click={save} disabled={saving}>Save</button>
		<button on:click={add}>Add more</button>
	</div>
	<div>{status}</div>
</div>
