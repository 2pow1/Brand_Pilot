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

const layoutBase = {
  layout: {
    type: 'string',
    enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09']
  },
  layout_name: {
    type: 'string'
  },
  usage_reason: {
    type: 'string'
  }
};

const textField = {
  type: 'string'
};

const stepSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description'],
  properties: {
    title: textField,
    description: textField
  }
};

const summaryItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['number', 'text'],
  properties: {
    number: textField,
    text: textField
  }
};

/**
 * Structured-output schema for the GrowthLine sketch-note Instagram template.
 */
export const INSTAGRAM_SKETCH_CARD_NEWS_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['content_title', 'content_angle', 'recommended_layout_flow', 'cover_image_prompt', 'caption', 'hashtags', 'cards'],
  properties: {
    content_title: textField,
    content_angle: textField,
    recommended_layout_flow: {
      type: 'array',
      minItems: 2,
      maxItems: 8,
      items: {
        type: 'string',
        enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09']
      }
    },
    cover_image_prompt: {
      type: 'string',
      description: 'Prompt for generating or selecting the first cover background image. Do not include card text here.'
    },
    caption: {
      type: 'string',
      description: 'Korean Instagram caption adapted from the approved master draft.'
    },
    hashtags: {
      type: 'array',
      minItems: 0,
      maxItems: 6,
      items: textField
    },
    cards: {
      type: 'array',
      minItems: 2,
      maxItems: 8,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'series', 'kicker', 'title', 'subtitle'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['01'] },
              layout_name: { type: 'string', enum: ['Cover'] },
              series: textField,
              kicker: textField,
              title: textField,
              subtitle: textField
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'question_label', 'question', 'answer_label', 'answer'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['02'] },
              layout_name: { type: 'string', enum: ['Q&A'] },
              question_label: textField,
              question: textField,
              answer_label: textField,
              answer: textField
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'problem_title', 'problem', 'solution_title', 'solution'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['03'] },
              layout_name: { type: 'string', enum: ['Problem / Solution'] },
              title: textField,
              problem_title: textField,
              problem: textField,
              solution_title: textField,
              solution: textField
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'steps'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['04'] },
              layout_name: { type: 'string', enum: ['Customer Flow'] },
              title: textField,
              steps: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: stepSchema
              }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'items'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['05'] },
              layout_name: { type: 'string', enum: ['Checklist'] },
              title: textField,
              items: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: textField
              }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'before', 'after'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['06'] },
              layout_name: { type: 'string', enum: ['Before / After'] },
              title: textField,
              before: textField,
              after: textField
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'description'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['07'] },
              layout_name: { type: 'string', enum: ['One Message'] },
              title: textField,
              description: textField
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'items'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['08'] },
              layout_name: { type: 'string', enum: ['Summary'] },
              title: textField,
              items: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: summaryItemSchema
              }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'layout_name', 'usage_reason', 'title', 'description', 'cta'],
            properties: {
              ...layoutBase,
              layout: { type: 'string', enum: ['09'] },
              layout_name: { type: 'string', enum: ['Closing'] },
              title: textField,
              description: textField,
              cta: textField
            }
          }
        ]
      }
    }
  }
});
