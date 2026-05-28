import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDoctorReportWithRemoteChecks, formatDoctorReport } from '../src/doctor.js';

const BASE_CONFIG = Object.freeze({
  metaAccessToken: 'meta-user-token',
  metaAppId: 'app-id',
  metaAppSecret: 'app-secret',
  metaGraphBaseUrl: 'https://graph.facebook.com/v25.0',
  metaTokenExpiryWarningDays: 7,
  instagramBusinessAccountId: '17841400000000000',
  supabaseStorageBucket: 'brand-pilot-instagram'
});

const DEFAULT_PAGE_DATA = Object.freeze([
  {
    id: 'page-1',
    name: 'Brand Page',
    tasks: ['ANALYZE', 'CREATE_CONTENT', 'MANAGE'],
    instagram_business_account: {
      id: BASE_CONFIG.instagramBusinessAccountId
    }
  }
]);

/**
 * Creates a fetch double that returns token debug, Instagram account, and Page responses.
 */
function createMetaFetch({
  debugData,
  accountData = { id: BASE_CONFIG.instagramBusinessAccountId },
  pageData = DEFAULT_PAGE_DATA
}) {
  return async (url) => {
    const parsed = new URL(String(url));

    if (parsed.pathname.endsWith('/debug_token')) {
      return Response.json({ data: debugData });
    }

    if (parsed.pathname.endsWith(`/${BASE_CONFIG.instagramBusinessAccountId}`)) {
      return Response.json(accountData);
    }

    if (parsed.pathname.endsWith('/me/accounts')) {
      return Response.json({ data: pageData });
    }

    return Response.json({ error: { message: 'unexpected endpoint' } }, { status: 404 });
  };
}

test('publish doctor fails when Meta reports an expired access token', async () => {
  const report = await buildDoctorReportWithRemoteChecks(BASE_CONFIG, 'publish', {
    now: new Date('2026-05-24T00:00:00.000Z'),
    fetchImpl: createMetaFetch({
      debugData: {
        is_valid: true,
        expires_at: Date.parse('2026-05-23T00:00:00.000Z') / 1000,
        scopes: ['instagram_basic', 'instagram_content_publish']
      }
    })
  });

  assert.equal(report.ok, false);
  assert.ok(report.missing.includes('META_ACCESS_TOKEN_EXPIRY'));
  assert.match(formatDoctorReport(report), /\[expired\] META_ACCESS_TOKEN_EXPIRY/);
});

test('publish doctor warns but does not fail when the Meta access token expires soon', async () => {
  const report = await buildDoctorReportWithRemoteChecks(BASE_CONFIG, 'publish', {
    now: new Date('2026-05-24T00:00:00.000Z'),
    fetchImpl: createMetaFetch({
      debugData: {
        is_valid: true,
        expires_at: Date.parse('2026-05-28T00:00:00.000Z') / 1000,
        scopes: ['instagram_basic', 'instagram_content_publish']
      }
    })
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);
  assert.match(formatDoctorReport(report), /\[warn\] META_ACCESS_TOKEN_EXPIRY/);
});

test('publish doctor reports missing Instagram publishing scopes', async () => {
  const report = await buildDoctorReportWithRemoteChecks(BASE_CONFIG, 'publish', {
    now: new Date('2026-05-24T00:00:00.000Z'),
    fetchImpl: createMetaFetch({
      debugData: {
        is_valid: true,
        expires_at: Date.parse('2026-06-24T00:00:00.000Z') / 1000,
        scopes: ['instagram_basic']
      }
    })
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['META_ACCESS_TOKEN_SCOPES']);
  assert.match(formatDoctorReport(report), /instagram_content_publish/);
});

test('publish doctor warns when app credentials are missing for expiry checks', async () => {
  const report = await buildDoctorReportWithRemoteChecks({
    ...BASE_CONFIG,
    metaAppId: '',
    metaAppSecret: ''
  }, 'publish', {
    fetchImpl: createMetaFetch({
      debugData: {}
    })
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);
  assert.match(formatDoctorReport(report), /\[warn\] META_APP_CREDENTIALS/);
});

test('publish doctor warns when no connected Facebook Page is visible for direct Instagram tokens', async () => {
  const report = await buildDoctorReportWithRemoteChecks(BASE_CONFIG, 'publish', {
    now: new Date('2026-05-24T00:00:00.000Z'),
    fetchImpl: createMetaFetch({
      debugData: {
        is_valid: true,
        expires_at: Date.parse('2026-06-24T00:00:00.000Z') / 1000,
        scopes: ['instagram_basic', 'instagram_content_publish']
      },
      pageData: [
        {
          id: 'page-2',
          name: 'Other Page',
          tasks: ['ANALYZE', 'CREATE_CONTENT'],
          instagram_business_account: {
            id: '17841499999999999'
          }
        }
      ]
    })
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);
  assert.match(formatDoctorReport(report), /No Facebook Page/);
  assert.match(formatDoctorReport(report), /\[warn\] INSTAGRAM_PAGE_CONNECTION/);
});

test('publish doctor reports missing Page content creation task', async () => {
  const report = await buildDoctorReportWithRemoteChecks(BASE_CONFIG, 'publish', {
    now: new Date('2026-05-24T00:00:00.000Z'),
    fetchImpl: createMetaFetch({
      debugData: {
        is_valid: true,
        expires_at: Date.parse('2026-06-24T00:00:00.000Z') / 1000,
        scopes: ['instagram_basic', 'instagram_content_publish']
      },
      pageData: [
        {
          id: 'page-1',
          name: 'Brand Page',
          tasks: ['ANALYZE'],
          instagram_business_account: {
            id: BASE_CONFIG.instagramBusinessAccountId
          }
        }
      ]
    })
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['INSTAGRAM_PAGE_CONNECTION']);
  assert.match(formatDoctorReport(report), /CREATE_CONTENT/);
});
