import { describeDatabaseProvider } from './provider.js';
import { openSqliteStore } from './sqlite-store.js';
import { createSupabaseStore } from './supabase-store.js';

export async function openDatabaseStore(config) {
  const provider = describeDatabaseProvider(config);

  if (provider.provider === 'sqlite') {
    return openSqliteStore(config);
  }

  return createSupabaseStore(config);
}
