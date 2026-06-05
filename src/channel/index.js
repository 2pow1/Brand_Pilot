import { createInstagramCardNewsPayload, createInstagramSketchCardNewsPayload } from './instagram.js';
import { createOpenAiInstagramCardNewsPayload } from './openai.js';

/**
 * Returns the deterministic mock generator for the configured Instagram template.
 */
function createMockInstagramPayload({ brand, item, channel }) {
  if (channel.template === 'instagram-sketch-card-news-v2') {
    return createInstagramSketchCardNewsPayload({ brand, item, channel });
  }

  return createInstagramCardNewsPayload({ brand, item, channel });
}

/**
 * Returns only channel definitions that should receive generated output in the current run.
 */
export function enabledChannels(channels) {
  return channels.filter((channel) => channel.enabled);
}

/**
 * Routes one approved content item through the channel-specific payload generator.
 */
export async function generateChannelOutput({ config, brand, item, channel, mock = false, fetchImpl = fetch }) {
  if (channel.id === 'instagram' && channel.format === 'card_news') {
    return {
      channelId: channel.id,
      payload: mock
        ? createMockInstagramPayload({ brand, item, channel })
        : await createOpenAiInstagramCardNewsPayload({
            config,
            brand,
            item,
            channel,
            fetchImpl
          })
    };
  }

  throw new Error(`Unsupported channel template: ${channel.id}/${channel.format}/${channel.template}`);
}

/**
 * Generates payloads for every enabled channel and rejects an empty channel configuration.
 */
export async function generateChannelOutputs({ config, brand, item, channels, mock = false, fetchImpl = fetch }) {
  const outputs = [];
  for (const channel of enabledChannels(channels)) {
    outputs.push(await generateChannelOutput({
      config,
      brand,
      item,
      channel,
      mock,
      fetchImpl
    }));
  }

  if (outputs.length === 0) {
    throw new Error('No enabled channels configured');
  }

  return outputs;
}
