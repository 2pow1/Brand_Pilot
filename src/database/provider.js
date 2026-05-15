const PROVIDERS = {
  SQLITE: 'sqlite',
  SUPABASE: 'supabase'
};

/**
 * Describes the configured database provider and whether it is the operational source of truth.
 */
export function describeDatabaseProvider(config) {
  if (config.databaseProvider === PROVIDERS.SQLITE) {
    return {
      provider: PROVIDERS.SQLITE,
      label: 'SQLite local fallback',
      sourceOfTruth: false
    };
  }

  if (config.databaseProvider === PROVIDERS.SUPABASE) {
    return {
      provider: PROVIDERS.SUPABASE,
      label: 'Supabase Postgres production database',
      sourceOfTruth: true
    };
  }

  throw new Error(`Unsupported DATABASE_PROVIDER: ${config.databaseProvider}`);
}
