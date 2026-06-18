import { openAppDatabase } from '../database.js';
import { printDatabaseInfo, printSummary } from '../output.js';

/**
 * Prints the current pipeline state summary.
 */
export async function runStatus() {
  const { store } = await openAppDatabase();
  printDatabaseInfo(store);
  printSummary(await store.summarize());
  await store.close();
}
