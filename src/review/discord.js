import { buildReviewPayload } from './message.js';

const REVIEW_MESSAGE_CHANNEL_TYPES = new Set([0, 5, 10, 11, 12]);

/**
 * Represents an actionable Discord review integration failure.
 */
export class DiscordReviewError extends Error {
  constructor(message, { status, code, hint } = {}) {
    super(message);
    this.name = 'DiscordReviewError';
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

/**
 * Reads a Discord JSON response without failing on empty or non-JSON bodies.
 */
async function readDiscordPayload(response) {
  return response.json().catch(() => ({}));
}

/**
 * Builds a targeted error for Discord bot identity or channel checks.
 */
function createDiscordApiError(response, payload, fallbackMessage, hint) {
  const message = payload.message || fallbackMessage;
  return new DiscordReviewError(message, {
    status: response.status,
    code: payload.code,
    hint
  });
}

/**
 * Returns an operator-facing explanation for Discord review failures.
 */
export function formatDiscordReviewError(error) {
  const lines = ['Discord review check failed.', `Reason: ${error.message}`];

  if (error.hint) {
    lines.push(`Hint: ${error.hint}`);
  }

  if (error.status || error.code) {
    const details = [
      error.status ? `HTTP ${error.status}` : '',
      error.code ? `Discord code ${error.code}` : ''
    ].filter(Boolean);
    lines.push(`Discord response: ${details.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Verifies that a Discord bot token and review channel can be reached.
 */
export async function checkDiscordReviewTarget({ config, fetchImpl = fetch }) {
  if (!config.discordBotToken) {
    throw new DiscordReviewError('DISCORD_BOT_TOKEN is required for Discord review checks.');
  }

  if (!config.discordReviewChannelId) {
    throw new DiscordReviewError('DISCORD_REVIEW_CHANNEL_ID is required for Discord review checks.');
  }

  const headers = {
    Authorization: `Bot ${config.discordBotToken}`
  };
  const botResponse = await fetchImpl(`${config.discordBaseUrl}/users/@me`, { headers });
  const bot = await readDiscordPayload(botResponse);

  if (!botResponse.ok) {
    throw createDiscordApiError(
      botResponse,
      bot,
      `Discord bot token check failed: HTTP ${botResponse.status}`,
      'Regenerate DISCORD_BOT_TOKEN from the Discord Developer Portal Bot page and paste the bot token, not the client secret or public key.'
    );
  }

  const channelResponse = await fetchImpl(`${config.discordBaseUrl}/channels/${config.discordReviewChannelId}`, {
    headers
  });
  const channel = await readDiscordPayload(channelResponse);

  if (!channelResponse.ok) {
    throw createDiscordApiError(
      channelResponse,
      channel,
      `Discord review channel check failed: HTTP ${channelResponse.status}`,
      'Check DISCORD_REVIEW_CHANNEL_ID, invite the bot to the same server, and grant the bot role View Channel plus Send Messages on that exact text channel.'
    );
  }

  if (!REVIEW_MESSAGE_CHANNEL_TYPES.has(channel.type)) {
    throw new DiscordReviewError(
      `DISCORD_REVIEW_CHANNEL_ID points to channel type ${channel.type}, which cannot receive review messages.`,
      {
        hint: 'Copy the ID from a Discord text or announcement channel, not from the server, category, role, message, or voice channel.'
      }
    );
  }

  return {
    botId: bot.id,
    botUsername: bot.username,
    channelId: channel.id,
    guildId: channel.guild_id || '',
    channelName: channel.name || '',
    channelType: channel.type
  };
}

/**
 * Sends one draft to Discord for human approval or rejection.
 */
export async function sendDiscordReviewRequest({ config, item, fetchImpl = fetch }) {
  const target = await checkDiscordReviewTarget({ config, fetchImpl });

  const response = await fetchImpl(`${config.discordBaseUrl}/channels/${config.discordReviewChannelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${config.discordBotToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildReviewPayload(item))
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createDiscordApiError(
      response,
      payload,
      `Discord request failed: HTTP ${response.status}`,
      'Confirm the bot still has View Channel and Send Messages permissions on the review channel.'
    );
  }

  return {
    messageId: payload.id,
    channelId: payload.channel_id || config.discordReviewChannelId,
    url: payload.guild_id || target.guildId
      ? `https://discord.com/channels/${payload.guild_id || target.guildId}/${payload.channel_id}/${payload.id}`
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
