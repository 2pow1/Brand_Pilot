import { openAppDatabase } from '../database.js';
import { printDatabaseInfo } from '../output.js';

/**
 * Initializes the configured database provider and verifies it can be opened.
 */
export async function runInit() {
  const { store } = await openAppDatabase();
  printDatabaseInfo(store);
  await store.close();
}
