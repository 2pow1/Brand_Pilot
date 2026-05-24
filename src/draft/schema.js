export const DRAFT_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'hook',
    'body',
    'cta',
    'keywords',
    'content_angle',
    'suggested_repurpose'
  ],
  properties: {
    title: {
      type: 'string',
      description: 'Short review title for the master draft.'
    },
    hook: {
      type: 'string',
      description: 'Opening hook that makes the target reader recognize the problem.'
    },
    body: {
      type: 'string',
      description: 'Review-ready Korean body content focused on practical implications for small business owners.'
    },
    cta: {
      type: 'object',
      additionalProperties: false,
      required: ['label', 'url'],
      properties: {
        label: {
          type: 'string'
        },
        url: {
          type: 'string'
        }
      }
    },
    keywords: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Core keywords or review notes that summarize the selected draft direction.'
    },
    content_angle: {
      type: 'string',
      enum: [
        'empathy-driven',
        'problem-awareness',
        'practical-insight',
        'trust-building',
        'motivational',
        'soft-conversion'
      ],
      description: 'The selected content strategy angle.'
    },
    suggested_repurpose: {
      type: 'object',
      additionalProperties: false,
      required: ['instagram', 'blog', 'linkedin'],
      properties: {
        instagram: {
          type: 'string'
        },
        blog: {
          type: 'string'
        },
        linkedin: {
          type: 'string'
        }
      }
    }
  }
});
