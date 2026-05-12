import nacl from 'https://esm.sh/tweetnacl@1.0.3?target=deno';

const DISCORD_RESPONSE_TYPES = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4
} as const;

const DISCORD_MESSAGE_FLAGS = {
  EPHEMERAL: 64
} as const;

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
}

function verifyDiscordSignature(request: Request, body: string) {
  const publicKey = getRequiredEnv('DISCORD_PUBLIC_KEY');
  const signature = request.headers.get('x-signature-ed25519') || '';
  const timestamp = request.headers.get('x-signature-timestamp') || '';
  const message = new TextEncoder().encode(`${timestamp}${body}`);

  const valid = nacl.sign.detached.verify(
    message,
    hexToBytes(signature),
    hexToBytes(publicKey)
  );

  if (!valid) {
    throw new Error('Invalid Discord signature');
  }
}

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

async function getContentItem(contentItemId: string) {
  const rows = await supabaseRequest(
    `content_items?select=*&id=eq.${encodeURIComponent(contentItemId)}&limit=1`
  );
  return rows[0] || null;
}

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

async function applyDecision(contentItemId: string, decision: 'approve' | 'reject') {
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

Deno.serve(async (request) => {
  try {
    const body = await request.text();
    verifyDiscordSignature(request, body);
    const interaction = JSON.parse(body);

    if (interaction.type === 1) {
      return jsonResponse({ type: DISCORD_RESPONSE_TYPES.PONG });
    }

    const customId = interaction.data?.custom_id || '';
    const [, action, contentItemId] = customId.split(':');

    if (!customId.startsWith('brandpilot:') || !contentItemId) {
      return jsonResponse({
        type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Brand Pilot 검수 버튼을 해석하지 못했습니다.',
          flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL
        }
      });
    }

    const decision = action === 'approve' ? 'approve' : 'reject';
    const result = await applyDecision(contentItemId, decision);
    const label = decision === 'approve' ? '승인' : '거절';
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
    const status = error instanceof Error && error.message === 'Invalid Discord signature' ? 401 : 200;
    return jsonResponse(
      {
        type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '검수 처리 중 오류가 발생했습니다.',
          flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL
        }
      },
      { status }
    );
  }
});
