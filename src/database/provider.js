const PROVIDERS = {
  SQLITE: 'sqlite',
  SUPABASE: 'supabase'
};

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

export function assertSqliteCliRuntime(config) {
  const provider = describeDatabaseProvider(config);

  if (provider.provider === PROVIDERS.SQLITE) {
    return;
  }

  throw new Error(
    'DATABASE_PROVIDER=supabase is configured, but this CLI command still uses the SQLite adapter. ' +
      'Apply supabase/schema.sql and add the Supabase adapter before running mutating jobs with Supabase. ' +
      'Use DATABASE_PROVIDER=sqlite for the current local fallback.'
  );
}
