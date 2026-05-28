const DEFAULT_REQUIRED_SCOPES = Object.freeze([
  'instagram_basic',
  'instagram_content_publish'
]);
const REQUIRED_PAGE_TASKS = Object.freeze([
  'CREATE_CONTENT'
]);

/**
 * Normalizes the Meta Graph API base URL before appending endpoint paths.
 */
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

/**
 * Converts a Unix timestamp in seconds into an ISO string.
 */
function unixSecondsToIso(value) {
  if (!value) return '';
  return new Date(value * 1000).toISOString();
}

/**
 * Calculates whole days remaining from a reference time.
 */
function daysUntil(expiresAt, now) {
  return Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000);
}

/**
 * Builds the app access token needed by Meta's debug_token endpoint.
 */
function appAccessToken(config) {
  if (!config.metaAppId || !config.metaAppSecret) return '';
  return `${config.metaAppId}|${config.metaAppSecret}`;
}

/**
 * Returns a safe warning threshold for token expiry checks.
 */
function expiryWarningDays(config) {
  const value = Number.isFinite(config.metaTokenExpiryWarningDays)
    ? config.metaTokenExpiryWarningDays
    : 7;
  return Math.max(1, value);
}

/**
 * Sends a GET request to the Meta Graph API without exposing tokens in errors.
 */
async function graphGet({ config, path, params = {}, accessToken, fetchImpl = fetch }) {
  const url = new URL(`${trimTrailingSlash(config.metaGraphBaseUrl)}/${path.replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set('access_token', accessToken || config.metaAccessToken);

  const response = await fetchImpl(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `Meta Graph API request failed: HTTP ${response.status}`);
  }

  return payload;
}

/**
 * Builds a doctor check result with a consistent shape.
 */
function checkResult({ name, ok, status, message = '', details = {} }) {
  return {
    name,
    ok,
    status,
    message,
    details
  };
}

/**
 * Checks the configured access token with Meta's debug_token endpoint when app credentials are available.
 */
async function checkTokenDebug({ config, fetchImpl, now }) {
  const tokenForDebug = appAccessToken(config);

  if (!tokenForDebug) {
    return [
      checkResult({
        name: 'META_APP_CREDENTIALS',
        ok: true,
        status: 'warning',
        message: 'Set META_APP_ID and META_APP_SECRET to detect access token expiry before it fails.'
      })
    ];
  }

  const payload = await graphGet({
    config,
    path: 'debug_token',
    params: {
      input_token: config.metaAccessToken
    },
    accessToken: tokenForDebug,
    fetchImpl
  });
  const data = payload.data || {};
  const scopes = data.scopes || [];
  const missingScopes = DEFAULT_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
  const checks = [
    checkResult({
      name: 'META_ACCESS_TOKEN_VALID',
      ok: data.is_valid === true,
      status: data.is_valid === true ? 'ok' : 'invalid',
      message: data.is_valid === true ? '' : 'Meta reports the access token is invalid.'
    })
  ];

  if (data.expires_at) {
    const expiresAt = unixSecondsToIso(data.expires_at);
    const remainingDays = daysUntil(expiresAt, now);
    const warningDays = expiryWarningDays(config);
    const expired = remainingDays <= 0;
    const expiringSoon = !expired && remainingDays <= warningDays;

    checks.push(checkResult({
      name: 'META_ACCESS_TOKEN_EXPIRY',
      ok: !expired,
      status: expired ? 'expired' : expiringSoon ? 'warning' : 'ok',
      message: expired
        ? `Access token expired at ${expiresAt}.`
        : expiringSoon
          ? `Access token expires at ${expiresAt} (${remainingDays} day(s) remaining).`
          : `Access token expires at ${expiresAt}.`,
      details: {
        expiresAt,
        remainingDays,
        warningDays
      }
    }));
  } else {
    checks.push(checkResult({
      name: 'META_ACCESS_TOKEN_EXPIRY',
      ok: true,
      status: 'ok',
      message: 'Meta did not return an expiry timestamp for this token.'
    }));
  }

  checks.push(checkResult({
    name: 'META_ACCESS_TOKEN_SCOPES',
    ok: missingScopes.length === 0,
    status: missingScopes.length === 0 ? 'ok' : 'missing_scope',
    message: missingScopes.length === 0
      ? ''
      : `Missing required scope(s): ${missingScopes.join(', ')}`,
    details: {
      requiredScopes: DEFAULT_REQUIRED_SCOPES,
      missingScopes
    }
  }));

  return checks;
}

/**
 * Verifies that the token can access the configured Instagram business account.
 */
async function checkInstagramAccountAccess({ config, fetchImpl }) {
  const payload = await graphGet({
    config,
    path: config.instagramBusinessAccountId,
    params: {
      fields: 'id'
    },
    fetchImpl
  });

  return checkResult({
    name: 'INSTAGRAM_BUSINESS_ACCOUNT_ACCESS',
    ok: payload.id === config.instagramBusinessAccountId,
    status: payload.id === config.instagramBusinessAccountId ? 'ok' : 'invalid',
    message: payload.id === config.instagramBusinessAccountId
      ? 'Connected to configured Instagram business account.'
      : 'Meta returned a different Instagram business account id.',
    details: {
      id: payload.id || ''
    }
  });
}

/**
 * Verifies that the token can see a Facebook Page connected to the configured IG account.
 */
async function checkInstagramPageConnection({ config, fetchImpl }) {
  const payload = await graphGet({
    config,
    path: 'me/accounts',
    params: {
      fields: 'id,name,tasks,instagram_business_account{id}'
    },
    fetchImpl
  });
  const pages = Array.isArray(payload.data) ? payload.data : [];
  const matchingPage = pages.find((page) => (
    page.instagram_business_account?.id === config.instagramBusinessAccountId
  ));

  if (!matchingPage) {
    return checkResult({
      name: 'INSTAGRAM_PAGE_CONNECTION',
      ok: false,
      status: 'invalid',
      message: 'No Facebook Page returned by /me/accounts is connected to the configured Instagram business account.',
      details: {
        pageCount: pages.length
      }
    });
  }

  const tasks = Array.isArray(matchingPage.tasks) ? matchingPage.tasks : [];
  const missingTasks = REQUIRED_PAGE_TASKS.filter((task) => !tasks.includes(task));

  return checkResult({
    name: 'INSTAGRAM_PAGE_CONNECTION',
    ok: missingTasks.length === 0,
    status: missingTasks.length === 0 ? 'ok' : 'missing_scope',
    message: missingTasks.length === 0
      ? `Connected through Facebook Page "${matchingPage.name || matchingPage.id}".`
      : `Connected Page is missing required task(s): ${missingTasks.join(', ')}`,
    details: {
      pageId: matchingPage.id || '',
      pageName: matchingPage.name || '',
      tasks,
      missingTasks
    }
  });
}

/**
 * Builds remote Meta preflight checks for Instagram publishing.
 */
export async function buildMetaPublishChecks({ config, fetchImpl = fetch, now = new Date() }) {
  const checks = [];

  try {
    checks.push(...await checkTokenDebug({ config, fetchImpl, now }));
  } catch (error) {
    checks.push(checkResult({
      name: 'META_ACCESS_TOKEN_DEBUG',
      ok: false,
      status: 'invalid',
      message: error.message
    }));
  }

  try {
    checks.push(await checkInstagramAccountAccess({ config, fetchImpl }));
  } catch (error) {
    checks.push(checkResult({
      name: 'INSTAGRAM_BUSINESS_ACCOUNT_ACCESS',
      ok: false,
      status: 'invalid',
      message: error.message
    }));
  }

  try {
    checks.push(await checkInstagramPageConnection({ config, fetchImpl }));
  } catch (error) {
    checks.push(checkResult({
      name: 'INSTAGRAM_PAGE_CONNECTION',
      ok: false,
      status: 'invalid',
      message: error.message
    }));
  }

  return checks;
}
