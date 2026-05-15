import { buildReviewPayload } from './message.js';

/**
 * Sends one draft to Discord for human approval or rejection.
 */
export async function sendDiscordReviewRequest({ config, item }) {
  if (!config.discordBotToken) {
    throw new Error('DISCORD_BOT_TOKEN is required. Use --mock to verify the review workflow locally.');
  }

  if (!config.discordReviewChannelId) {
    throw new Error('DISCORD_REVIEW_CHANNEL_ID is required. Use --mock to verify the review workflow locally.');
  }

  const response = await fetch(`${config.discordBaseUrl}/channels/${config.discordReviewChannelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${config.discordBotToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildReviewPayload(item))
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Discord request failed: HTTP ${response.status}`);
  }

  return {
    messageId: payload.id,
    channelId: payload.channel_id || config.discordReviewChannelId,
    url: payload.guild_id
      ? `https://discord.com/channels/${payload.guild_id}/${payload.channel_id}/${payload.id}`
      : ''
  };
}

/**
 * Creates review metadata without calling Discord so pipeline state can be tested locally.
 */
export function createMockReviewRequest(item) {
  return {
    messageId: `mock_review_${item.id}`,
    channelId: 'mock',
    url: ''
  };
}
