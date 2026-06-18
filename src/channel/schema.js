export const INSTAGRAM_CHANNEL_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['slides', 'caption', 'hashtags', 'visual_notes'],
  properties: {
    slides: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'label', 'headline', 'body', 'emphasis'],
        properties: {
          role: {
            type: 'string',
            enum: ['hook', 'problem', 'insight', 'solution', 'closing', 'cta']
          },
          label: {
            type: 'string'
          },
          headline: {
            type: 'string'
          },
          body: {
            type: 'string'
          },
          emphasis: {
            type: 'string'
          }
        }
      }
    },
    caption: {
      type: 'string',
      description: 'Korean Instagram caption adapted from the approved master draft.'
    },
    hashtags: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'string'
      }
    },
    visual_notes: {
      type: 'string',
      description: 'Short rendering guidance for the card-news layout.'
    }
  }
});

export { INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA } from '../prompts/instagram/sketch-card-news-v2/schema.js';
