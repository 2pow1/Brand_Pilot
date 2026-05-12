export const DRAFT_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body', 'angle', 'key_points', 'cta'],
  properties: {
    title: {
      type: 'string',
      description: 'Short internal review title for the marketing draft.'
    },
    body: {
      type: 'string',
      description: 'Review-ready Korean draft that can later become channel-specific content.'
    },
    angle: {
      type: 'string',
      description: 'The core marketing angle used in the draft.'
    },
    key_points: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    cta: {
      type: 'string',
      description: 'Suggested call to action.'
    }
  }
});
