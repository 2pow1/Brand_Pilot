/**
 * Returns the current timestamp in ISO-8601 format for persisted rows and events.
 */
export function nowIso() {
  return new Date().toISOString();
}
