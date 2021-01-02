<script lang="ts">
</script>

<style>
	main {
		position: relative;
		max-width: 56em;
		background-color: black;
		color: #fff;
		padding: 2em;
		margin: 0 auto;
		box-sizing: border-box;
	}
	footer {
		margin-top: 4em;
		text-align: center;
	}
	:global(body) {
		background-color: black;
		color: white;
	}
</style>

<main>
	<slot />
	<footer><a href="https://3v.fi/">3v.fi</a></footer>
</main>
