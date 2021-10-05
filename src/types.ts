export type Feed = {
  url: string;
  lastItem?: { isoDate: string };
  hookUrl: string;
  name: string;
  imageUrl: string;
};

export type DiscordEmbed = {
  title?: string;
  type?: "rich";
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  thumbnail?: DiscordEmbedThumbnail;
};

export type DiscordEmbedThumbnail = {
  url?: string;
  proxy_url?: string;
  height?: number;
  width?: number;
};
