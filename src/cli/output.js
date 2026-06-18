/**
 * Prints structured command output as formatted JSON.
 */
export function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Prints which database provider and location are active for the current command.
 */
export function printDatabaseInfo(store) {
  console.log(`Database provider: ${store.label}`);
  console.log(`Database: ${store.location}`);
}
