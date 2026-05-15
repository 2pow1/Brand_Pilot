/**
 * Downloads HTML from a source URL with a timeout and a crawler-friendly user agent.
 */
export async function fetchHtml(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BrandPilotMVP/0.1 (+https://github.com/2pow1/Brand_Pilot)',
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
