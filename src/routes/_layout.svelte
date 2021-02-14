<script lang="ts">
  import { Link } from "carbon-components-svelte";
</script>

<main>
  <slot />
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
</style>
