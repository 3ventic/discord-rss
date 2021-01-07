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
	import type { Feed } from "../types";

	export let feeds: Feed[];
	$: feeds = feeds;
	$: saving = false;
	$: status = "";

	const save = async () => {
		saving = true;
		try {
			let result = await fetch(`index.json`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(feeds),
			});
			let json = await result.json();
			status = `${result.statusText}: ${json.message || ""}`;
		} catch (e) {
			console.error(e);
		}
	};

	const add = () => {
		feeds = [
			...feeds,
			{
				hookUrl: "",
				lastItem: {
					pubDate: new Date().toISOString(),
				},
				name: "",
				url: "",
				imageUrl: "",
			},
		];
	};
</script>

<style>
	input {
		background: #333;
		color: #eee;
		padding: 0.2em;
		border: 1px solid #eee;
		margin: 0.2em;
	}
	button {
		background: #000;
		border: 1px solid #eee;
		color: #eee;
	}
	button:hover {
		background: #333;
	}
</style>

<svelte:head>
	<title>SapDiscoRSS Settings</title>
</svelte:head>

<div>
	<div>
		<h1>SapDiscoRSS Manager</h1>
		<p>Changes are not saved until you click save.</p>
		<p>
			Name / Title, Link to RSS/Atom feed, Link to Discord webhook, Link to
			attachment image (scaled to 50x50px)
		</p>
	</div>
	{#each feeds as feed, i}
		<div>
			<input type="text" placeholder="Name / Title" bind:value={feed.name} />,
			<input
				type="url"
				placeholder="https://example.com/feed.rss"
				bind:value={feed.url} />,
			<input
				type="url"
				placeholder="https://discord.com/api/webhooks/..."
				bind:value={feed.hookUrl} />
			<input
				type="url"
				placeholder="https://i.3v.fi/...png"
				bind:value={feed.imageUrl} />
			<button
				on:click={() => {
					feeds = feeds.splice(i, 1);
				}}>X</button>
		</div>
	{/each}
	<div>
		<button on:click={save} disabled={saving}>Save</button>
		<button on:click={add}>Add more</button>
	</div>
	<div>{status}</div>
</div>
