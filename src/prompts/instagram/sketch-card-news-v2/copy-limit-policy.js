/**
 * Prompt-side copy budgets. Character counts exclude spaces and line breaks.
 * Keep renderer fit thresholds and JSON Schema hard limits in their own policies.
 */
export const SKETCH_PROMPT_COPY_LIMITS = Object.freeze({
  template: Object.freeze({
    width: 1080,
    height: 1350
  }),
  common: Object.freeze({
    shortTitleNoBreakCharacters: 12,
    maxTitleLines: 3,
    shortBodyNoBreakCharacters: 18
  }),

  // Layout 01: Cover
  cover: Object.freeze({
    kickerMaxCharacters: 18,
    titlePreferredLines: 1,
    titleMaxLines: 3,
    titleTargetCharacters: 30,
    titleMaxLineCharacters: 13,
    subtitleMaxLines: 3,
    subtitleTargetCharacters: 44
  }),

  // Layout 02: Q&A
  qa: Object.freeze({
    questionPreferredLines: 1,
    questionMaxLines: 2,
    questionTargetCharacters: 28,
    answerMinLines: 1,
    answerMaxLines: 5,
    answerTargetCharacters: 115
  }),

  // Layout 03: Problem / Solution
  problemSolution: Object.freeze({
    titlePreferredLines: 1,
    titleMaxLines: 2,
    titleTargetCharacters: 26,
    problemMinLines: 1,
    problemMaxLines: 4,
    problemTargetCharacters: 65,
    solutionMinLines: 1,
    solutionMaxLines: 4,
    solutionTargetCharacters: 75
  }),

  // Layout 04: Customer Flow
  customerFlow: Object.freeze({
    titlePreferredLines: 1,
    titleMaxLines: 2,
    titleTargetCharacters: 26,
    stepTitleMaxCharacters: 10,
    stepDescriptionMinLines: 1,
    stepDescriptionMaxLines: 2,
    stepDescriptionTargetCharacters: 34
  }),

  // Layout 05: Checklist / Layout 08: Summary (shared limits)
  checklistAndSummary: Object.freeze({
    titlePreferredLines: 1,
    titleMaxLines: 2,
    titleTargetCharacters: 24,
    itemMinLines: 1,
    itemMaxLines: 2,
    itemTargetCharacters: 32
  }),

  // Layout 06: Before / After
  beforeAfter: Object.freeze({
    titlePreferredLines: 1,
    titleMaxLines: 2,
    titleTargetCharacters: 24,
    beforeMinLines: 1,
    beforeMaxLines: 4,
    beforeTargetCharacters: 65,
    afterMinLines: 1,
    afterMaxLines: 4,
    afterTargetCharacters: 75
  }),

  // Layout 07: One Message / Layout 09: Closing (shared limits)
  oneMessageAndClosing: Object.freeze({
    titlePreferredLines: 1,
    titleMaxLines: 2,
    titleTargetCharacters: 30,
    bodyMinLines: 1,
    bodyMaxLines: 4,
    descriptionTargetCharacters: 80,
    ctaTargetCharacters: 45
  })
});
