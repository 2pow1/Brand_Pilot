import { loadConfig } from '../config.js';
import { openDatabaseStore } from '../database/index.js';

/**
 * Opens the configured app store and returns it with loaded runtime config.
 */
export async function openAppDatabase() {
  const config = loadConfig();
  const store = await openDatabaseStore(config);
  return { store, config };
}
