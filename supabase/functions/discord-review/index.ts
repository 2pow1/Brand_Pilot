import nacl from 'https://esm.sh/tweetnacl@1.0.3?target=deno';

const DISCORD_RESPONSE_TYPES = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4
} as const;

const DISCORD_MESSAGE_FLAGS = {
  EPHEMERAL: 64
} as const;

type ReviewDecision = 'approve' | 'reject';

/**
 * Marks requests that failed Discord's required signature verification.
 */
class DiscordSignatureError extends Error {
  constructor(message = 'Invalid Discord signature') {
    super(message);
    this.name = 'DiscordSignatureError';
  }
}

/**
 * Reads a required Supabase Edge Function secret.
 */
function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/**
 * Converts Discord's hex-encoded signature and public key into bytes for verification.
 */
function hexToBytes(hex: string): Uint8Array {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new DiscordSignatureError();
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Builds the JSON response shape Discord expects from an interaction endpoint.
 */
function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
}

/**
 * Verifies Discord's Ed25519 request signature before trusting interaction payloads.
 */
function verifyDiscordSignature(request: Request, body: string) {
  const publicKey = getRequiredEnv('DISCORD_PUBLIC_KEY');
  const signature = request.headers.get('x-signature-ed25519') || '';
  const timestamp = request.headers.get('x-signature-timestamp') || '';
  const message = new TextEncoder().encode(`${timestamp}${body}`);

  let valid = false;
  try {
    valid = nacl.sign.detached.verify(
      message,
      hexToBytes(signature),
      hexToBytes(publicKey)
    );
  } catch {
    throw new DiscordSignatureError();
  }

  if (!valid) {
    throw new DiscordSignatureError();
  }
}

/**
 * Sends one authenticated request to Supabase REST from the Edge Function runtime.
 */
async function supabaseRequest(path: string, init: RequestInit = {}) {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase request failed: HTTP ${response.status}`);
  }

  return text ? JSON.parse(text) : null;
}

/**
 * Loads the content item referenced by a Discord button custom_id.
 */
async function getContentItem(contentItemId: string) {
  const rows = await supabaseRequest(
    `content_items?select=*&id=eq.${encodeURIComponent(contentItemId)}&limit=1`
  );
  return rows[0] || null;
}

/**
 * Appends a review event after applying an interaction decision.
 */
async function insertEvent(contentItemId: string, eventType: string, payload: Record<string, unknown>) {
  await supabaseRequest('events', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      content_item_id: contentItemId,
      event_type: eventType,
      payload_json: payload
    })
  });
}

/**
 * Applies an approve or reject decision only when the item is still pending review.
 */
async function applyDecision(contentItemId: string, decision: ReviewDecision) {
  const item = await getContentItem(contentItemId);

  if (!item) {
    throw new Error(`Content item not found: ${contentItemId}`);
  }

  if (item.status !== 'pending_review') {
    return {
      status: item.status,
      changed: false
    };
  }

  const status = decision === 'approve' ? 'approved' : 'rejected';
  const eventType = decision === 'approve' ? 'content.review.approved' : 'content.review.rejected';
  const now = new Date().toISOString();

  await supabaseRequest(`content_items?id=eq.${encodeURIComponent(contentItemId)}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      status,
      review_decision_at: now,
      rejection_reason: decision === 'reject' ? 'discord-button-reject' : '',
      updated_at: now,
      last_error: ''
    })
  });

  await insertEvent(contentItemId, eventType, {
    mode: 'discord-interaction',
    status
  });

  return {
    status,
    changed: true
  };
}

/**
 * Parses Brand Pilot button IDs and rejects unknown actions without changing content state.
 */
function parseReviewButton(customId: string): { decision: ReviewDecision; contentItemId: string } | null {
  const [namespace, action, contentItemId] = customId.split(':');
  if (namespace !== 'brandpilot') return null;
  if (action !== 'approve' && action !== 'reject') return null;
  if (!contentItemId) return null;

  return {
    decision: action,
    contentItemId
  };
}

Deno.serve(async (request) => {
  try {
    const body = await request.text();
    verifyDiscordSignature(request, body);
    const interaction = JSON.parse(body);

    if (interaction.type === 1) {
      return jsonResponse({ type: DISCORD_RESPONSE_TYPES.PONG });
    }

    const parsed = parseReviewButton(interaction.data?.custom_id || '');
    if (!parsed) {
      return jsonResponse({
        type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Brand Pilot 검수 버튼을 해석하지 못했습니다.',
          flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL
        }
      });
    }

    const result = await applyDecision(parsed.contentItemId, parsed.decision);
    const label = parsed.decision === 'approve' ? '승인' : '거절';
    const content = result.changed
      ? `${label} 처리했습니다.`
      : `이미 ${result.status} 상태라 변경하지 않았습니다.`;

    return jsonResponse({
      type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content,
        flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL
      }
    });
  } catch (error) {
    console.error(error);
    if (error instanceof DiscordSignatureError) {
      return jsonResponse({ message: 'Invalid Discord signature' }, { status: 401 });
    }

    return jsonResponse(
      {
        type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '검수 처리 중 오류가 발생했습니다.',
          flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL
        }
      }
    );
  }
});
