import { createInstagramCardNewsPayload } from './instagram.js';

export function enabledChannels(channels) {
  return channels.filter((channel) => channel.enabled);
}

export function generateChannelOutput({ brand, item, channel }) {
  if (channel.id === 'instagram' && channel.format === 'card_news') {
    return {
      channelId: channel.id,
      payload: createInstagramCardNewsPayload({ brand, item, channel })
    };
  }

  throw new Error(`Unsupported channel template: ${channel.id}/${channel.format}/${channel.template}`);
}

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
