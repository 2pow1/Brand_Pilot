import { createInstagramCardNewsPayload } from './instagram.js';

/**
 * Returns only channel definitions that should receive generated output in the current run.
 */
export function enabledChannels(channels) {
  return channels.filter((channel) => channel.enabled);
}

/**
 * Routes one approved content item through the channel-specific payload generator.
 */
export function generateChannelOutput({ brand, item, channel }) {
  if (channel.id === 'instagram' && channel.format === 'card_news') {
    return {
      channelId: channel.id,
      payload: createInstagramCardNewsPayload({ brand, item, channel })
    };
  }

  throw new Error(`Unsupported channel template: ${channel.id}/${channel.format}/${channel.template}`);
}

/**
 * Generates payloads for every enabled channel and rejects an empty channel configuration.
 */
export function generateChannelOutputs({ brand, item, channels }) {
  const outputs = enabledChannels(channels).map((channel) =>
    generateChannelOutput({
      brand,
      item,
      channel
    })
  );

  if (outputs.length === 0) {
    throw new Error('No enabled channels configured');
  }

  return outputs;
}
