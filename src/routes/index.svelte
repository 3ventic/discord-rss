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
  import { Button, TextInput } from "carbon-components-svelte";
  import PhoneOutgoingFilled20 from "carbon-icons-svelte/lib/PhoneOutgoingFilled20";
  import TrashCan20 from "carbon-icons-svelte/lib/TrashCan20";
  import type { DiscordEmbed, Feed } from "../types";

  export let feeds: Feed[];
  let fds = feeds;
  let saving = false;
  let status = "";
  let testing = false;

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
    saving = false;
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

  $: console.log("feeds changed:", fds);

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

<svelte:head>
  <title>RSS Settings</title>
</svelte:head>

<div class="main">
  <div class="header">
    <h1>Discord RSS Feed Manager</h1>
  </div>
  {#each fds as feed, i}
    <div class="feedwrap">
      <div class="feedhead">
        <strong>#{i + 1}: {feed.name}</strong>
        <Button
          iconDescription="Delete"
          kind="danger-tertiary"
          icon={TrashCan20}
          on:click={() => {
            fds.splice(i, 1);
            fds = fds; // workaround to a render update bug
          }}
        />
      </div>
      <div class="feeditem">
        <TextInput inline labelText="Title" bind:value={feed.name} />
      </div>
      <div class="feeditem">
        <TextInput
          inline
          labelText="Atom/RSS URL"
          type="url"
          bind:value={feed.url}
        />
      </div>
      <div class="feeditem">
        <TextInput
          inline
          labelText="Discord Webhook URL"
          type="url"
          bind:value={feed.hookUrl}
        />
        <div class="margin-left">
          <Button
            size="small"
            kind="tertiary"
            tooltipPosition="left"
            tooltipAlignment="end"
            iconDescription="Send a test message"
            icon={PhoneOutgoingFilled20}
            on:click={() => testHook(feed)}
            disabled={testing}
          />
        </div>
      </div>
      <div class="feeditem">
        <TextInput
          inline
          labelText="Thumbnail URL"
          type="url"
          bind:value={feed.imageUrl}
        />
        <img
          src={feed.imageUrl}
          alt="thumbnail"
          class={`thumbnail margin-left ${feed.imageUrl ? "" : "hidden"}`}
        />
      </div>
    </div>
  {/each}
  <div class="actions">
    <Button on:click={save} disabled={saving}>Save</Button>
    <Button on:click={add} kind="secondary">Add more</Button>
  </div>
  <div>{status}</div>
</div>

<style>
  .main {
    width: 90%;
  }
  .feedhead {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .feeditem {
    margin: 0.5rem;
    display: flex;
    align-items: center;
  }
  .actions {
    text-align: center;
  }
  .header,
  h1 {
    text-align: center;
  }
  .thumbnail {
    max-height: 2em;
    max-width: 5em;
  }
  .margin-left {
    margin-left: 0.5em;
  }
</style>
