<script lang="ts">
</script>

<style>
	main {
		width: calc(100%-2em);
		color: rgb(202, 202, 202);
		padding: 2em;
		margin: 0 auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}
	footer {
		margin-top: 4em;
		text-align: center;
	}
	:global(body) {
		background-color: rgb(17, 30, 51);
	}
</style>

<main>
	<slot />
	<footer><a href="https://3v.fi/">3v.fi</a></footer>
</main>
