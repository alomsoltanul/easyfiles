/**
 * Turn a fetched page into something safe to drop into a same-origin iframe.
 *
 * Two jobs:
 *  1. Strip everything executable — the iframe is also sandboxed without
 *     `allow-scripts`, so this is defence in depth rather than the only line.
 *  2. Route every sub-resource through our own asset proxy. html2canvas reads
 *     pixels back out of the DOM, and a single cross-origin image would taint
 *     the canvas and break the whole export.
 */

export const ASSET_PROXY = '/api/html/asset';

export function proxyUrl(absolute: string): string {
  return `${ASSET_PROXY}?u=${encodeURIComponent(absolute)}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/**
 * Attribute values arrive HTML-escaped, so a query string reads `a&amp;b`.
 * Those entities have to go before the URL is parsed, otherwise the proxied
 * request asks the origin for a literal `&amp;`.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function absolutize(value: string, base: string): string | null {
  const trimmed = decodeEntities(value).trim();
  if (!trimmed) return null;
  if (/^(data:|blob:|about:|javascript:|mailto:|tel:|#)/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Rewrite `url(...)` and `@import` targets inside a stylesheet. */
export function rewriteCss(css: string, base: string): string {
  let out = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, raw) => {
    const abs = absolutize(raw, base);
    return abs ? `url(${quote}${proxyUrl(abs)}${quote})` : match;
  });

  out = out.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, raw) => {
    const abs = absolutize(raw, base);
    return abs ? `@import ${quote}${proxyUrl(abs)}${quote}` : match;
  });

  return out;
}

function rewriteSrcset(value: string, base: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      if (parts.length === 0 || !parts[0]) return candidate;
      const abs = absolutize(parts[0], base);
      if (!abs) return candidate;
      parts[0] = proxyUrl(abs);
      return parts.join(' ');
    })
    .join(', ');
}

const DROP_TAGS = ['script', 'noscript', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'template'];

export interface PreparedPage {
  html: string;
  title: string;
  /** Sub-resources rewritten to go through the proxy. */
  assets: number;
}

export function preparePage(rawHtml: string, baseUrl: string): PreparedPage {
  let html = rawHtml;
  let assets = 0;

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim().slice(0, 200) ?? '';

  // 1. Remove executable and framing content entirely.
  for (const tag of DROP_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }
  html = html.replace(/<base\b[^>]*>/gi, '');
  html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*['"]?refresh['"]?[^>]*>/gi, '');

  // 2. Drop inline event handlers.
  html = html.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '');
  html = html.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '');
  html = html.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');

  // 3. Rewrite <style> blocks.
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_m, attrs, css) => {
    return `<style${attrs}>${rewriteCss(css, baseUrl)}</style>`;
  });

  // 4. Rewrite element attributes that pull in a resource.
  const attrRewrites: { attr: string; proxy: boolean }[] = [
    { attr: 'src', proxy: true },
    { attr: 'data-src', proxy: true },
    { attr: 'poster', proxy: true },
    { attr: 'href', proxy: false },
  ];

  for (const { attr, proxy } of attrRewrites) {
    const pattern = new RegExp(`(<([a-z0-9]+)\\b[^>]*?\\s)${attr}\\s*=\\s*(['"])([^'"]*)\\3`, 'gi');
    html = html.replace(pattern, (match, prefix, tagName, quote, value) => {
      const abs = absolutize(value, baseUrl);
      if (!abs) return match;
      const tag = String(tagName).toLowerCase();
      // Stylesheet links go through the proxy; ordinary anchors stay clickable.
      const shouldProxy = proxy || (tag === 'link' && /rel\s*=\s*['"]?[^'">]*stylesheet/i.test(match));
      if (shouldProxy) assets++;
      return `${prefix}${attr}=${quote}${shouldProxy ? proxyUrl(abs) : abs}${quote}`;
    });
  }

  html = html.replace(/\ssrcset\s*=\s*(['"])([^'"]*)\1/gi, (_m, quote, value) => {
    assets++;
    return ` srcset=${quote}${rewriteSrcset(value, baseUrl)}${quote}`;
  });

  // 5. Inline style attributes can also reference images.
  html = html.replace(/\sstyle\s*=\s*"([^"]*)"/gi, (match, css) => {
    if (!/url\(/i.test(css)) return match;
    return ` style="${rewriteCss(css, baseUrl).replace(/"/g, '&quot;')}"`;
  });

  // 6. Give the document a base so anything we missed still resolves, and
  //    neutralise lazy-loading so html2canvas sees real pixels.
  const injected = `<base href="${baseUrl.replace(/"/g, '&quot;')}">
<style>
  html, body { overflow: visible !important; height: auto !important; }
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  [loading="lazy"] { content-visibility: visible !important; }
  .sticky, [style*="position:fixed"], [style*="position: fixed"] { position: static !important; }
</style>`;

  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${injected}`);
  } else {
    html = `<head>${injected}</head>${html}`;
  }

  return { html, title, assets };
}
