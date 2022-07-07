<script lang="ts">
	import { Link, Loading, Theme } from "carbon-components-svelte";
	import type { CarbonTheme } from "carbon-components-svelte/types/Theme/Theme.svelte";
	import { onMount } from "svelte";

	import { goto } from "$app/navigation";
	import { session } from "$app/stores";
	import type { AppSession } from "src/auth";
	const signedIn = !!($session as AppSession).user;
	onMount(() => {
		if (!signedIn) {
			goto("/api/auth/signin/discord?redirect=/");
		}
	});

	let theme: CarbonTheme = "g10";
	let loading = true;

	onMount(() => {
		if (localStorage.getItem("theme") !== null) {
			theme = localStorage.getItem("theme") as CarbonTheme;
		} else if (
			window.matchMedia &&
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			theme = "g100";
		} else {
			theme = "g10";
		}
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", function (e) {
				theme = e.matches ? "g100" : "g10";
			});

		loading = false;
	});
</script>

<main>
	{#if loading}
		<div class="loading">
			<Loading withOverlay={false} />
		</div>
	{:else if $session["user"]?.isAuthorized}
		<div class="header">
			<div />
			<h1>Discord RSS Feed Manager</h1>
			<Theme
				bind:theme
				render="toggle"
				toggle={{
					themes: ["g10", "g100"],
					labelA: "Dark Mode",
					labelB: "Dark Mode",
				}}
				on:update={(e) => {
					localStorage.setItem("theme", e.detail.theme);
				}}
			/>
		</div>
		<slot />
	{:else}
		<div>Unauthorized. <a href="/api/auth/signout">Sign out</a></div>
	{/if}
	<footer><Link href="https://3v.fi/">3v.fi</Link></footer>
</main>

<style>
	main {
		padding: 2em;
		margin: 0 auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	footer {
		margin-top: 4em;
		text-align: center;
	}
	:global(body, html) {
		margin: 0;
		padding: 0;
	}
	.header h1 {
		text-align: center;
		flex-grow: 5;
	}
	.header {
		display: grid;
		grid-template-columns: 20em auto 20em;
		justify-content: space-between;
		width: 100%;
		margin: 1em 0;
	}
</style>
