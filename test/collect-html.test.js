import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractCandidatesFromHtml } from '../src/collect/html.js';

test('extracts article candidates from JSON-LD and anchors', () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": "Five branding signals small teams should watch",
            "url": "/insight/branding-signals",
            "description": "A practical article about brand positioning."
          }
        </script>
      </head>
      <body>
        <a href="/article/customer-research">Customer research questions for founders</a>
        <a href="mailto:hello@example.com">Contact us</a>
        <a href="/about">About</a>
      </body>
    </html>
  `;

  const candidates = extractCandidatesFromHtml(html, {
    baseUrl: 'https://example.com/blog',
    maxCandidates: 10
  });

  assert.deepEqual(candidates, [
    {
      url: 'https://example.com/insight/branding-signals',
      title: 'Five branding signals small teams should watch',
      excerpt: 'A practical article about brand positioning.'
    },
    {
      url: 'https://example.com/article/customer-research',
      title: 'Customer research questions for founders',
      excerpt: ''
    }
  ]);
});

test('deduplicates candidates by absolute URL', () => {
  const html = `
    <a href="/blog/same">Same article title</a>
    <a href="https://example.com/blog/same">Same article title</a>
  `;

  const candidates = extractCandidatesFromHtml(html, {
    baseUrl: 'https://example.com',
    maxCandidates: 10
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, 'https://example.com/blog/same');
});
