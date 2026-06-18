import { contentTransitions } from '../../state.js';

/**
 * Prints the allowed content status transition table.
 */
export function runTransitions() {
  console.log(JSON.stringify(contentTransitions(), null, 2));
}
