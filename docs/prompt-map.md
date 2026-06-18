# Prompt Map

This document is the first stop for GPT prompt maintenance.

The code-level index lives in `src/prompts/registry.js`. The registry is intentionally discovery-only for now: it points to prompt builders, schemas, post-processing, renderers, and verification commands without changing the current runtime flow.

## Why This Exists

Prompt changes currently require checking several layers:

- prompt text
- structured output schema
- OpenAI request wrapper
- post-processing and normalization
- renderer layout fallback
- preview or test command

Keeping the map explicit prevents prompt edits from depending on memory of the source tree.

## Prompt Inventory

| Prompt id | Purpose | Primary edit point | Contract files | Verification |
| --- | --- | --- | --- | --- |
| `draft.master.v1` | Convert collected source material into the approved master draft shape. | `src/draft/prompt.js` | `src/draft/schema.js`, `src/draft/openai.js`, `src/openai/responses.js` | `node --no-warnings=ExperimentalWarning --test test/draft.test.js` |
| `instagram.card-news.v1` | Adapt an approved master draft into the original Instagram card-news payload. | `src/channel/prompt.js` | `src/channel/schema.js`, `src/channel/openai.js`, `src/channel/instagram.js`, `src/openai/responses.js` | `node --no-warnings=ExperimentalWarning --test test/channel-openai.test.js` |
| `instagram.sketch-card-news.v2` | Adapt an approved master draft into the sketch-note card-news payload. | `src/prompts/instagram/sketch-card-news-v2/index.js` | `src/prompts/instagram/sketch-card-news-v2/prompt.js`, `src/prompts/instagram/sketch-card-news-v2/schema.js`, `src/prompts/instagram/sketch-card-news-v2/text-fit-policy.js`, `src/channel/instagram.js`, `src/render/instagram-sketch.js`, `src/openai/responses.js` | `node --no-warnings=ExperimentalWarning --test test/prompt-eval.test.js` |
| `instagram.cover-image.v1` | Add final no-text constraints for OpenAI Image API cover backgrounds. | `src/openai/image.js` | `src/channel/prompt.js`, `src/render/instagram-sketch.js` | `node --no-warnings=ExperimentalWarning --test test/openai-image.test.js` |

## Edit Checklist

When changing a prompt, check the matching registry entry first:

1. Update the prompt builder listed in `sourceFiles`.
2. If output fields or limits change, update the schema in the same prompt spec.
3. If line length, title length, or layout fit rules change, update both normalization and renderer-related files listed in `relatedFiles`.
4. Run the verification commands from the registry entry.
5. For `instagram.sketch-card-news.v2`, render a known content id with `scripts/preview-v2-cover-render.mjs` when the change affects visual layout.
6. If the OpenAI Responses API request shape or response parsing changes, run `node --no-warnings=ExperimentalWarning --test test/openai-responses.test.js`.
7. If `instagram.sketch-card-news.v2` prompt wording, text-fit guidance, schema, or normalization changes, update representative cases in `test-fixtures/prompt-evals/` when needed and run `node --no-warnings=ExperimentalWarning --test test/prompt-eval.test.js` before visual render review.

## Phased Cleanup Plan

Phase 1 keeps runtime behavior unchanged and adds the prompt map plus registry. This makes the current system searchable before moving code.

Phase 2 moves the sketch v2 prompt, schema, text-fit policy, and renderer-facing contract into `src/prompts/instagram/sketch-card-news-v2`.

Phase 3 extracts the duplicated OpenAI Responses API request assembly into `src/openai/responses.js`.

Phase 4 adds offline prompt eval fixtures for representative sketch v2 content so prompt, schema, and text-fit regressions are caught before visual render review.
