import 'server-only';

import type { ThemeConfig } from '@/lib/supabase/database.types';

export interface BioRequest {
  name: string;
  niche: string;
  tone: 'professional' | 'casual' | 'creative' | 'bold' | 'minimalist';
  keywords?: string;
}

export interface SmartLinkMetadata {
  title: string;
  description?: string;
  icon?: string;
}

/**
 * Generates punchy social bio options using Gemini/OpenAI API if keys exist,
 * or intelligent algorithmic templates if offline/unconfigured.
 */
export async function generateAIBios(req: BioRequest): Promise<string[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const systemPrompt = `You are an expert social media copywriter. Generate 3 distinct, punchy, engaging bio options for a personal link-in-bio (Linktree) profile page.
Name: ${req.name || 'Creator'}
Niche / Focus: ${req.niche || 'Digital creator & tech enthusiast'}
Tone: ${req.tone}
Keywords: ${req.keywords || 'none'}

Rules:
- Each bio must be under 160 characters.
- Use 1-2 tasteful emojis max per bio.
- Include a subtle call-to-action or hook.
- Return ONLY a JSON array of 3 strings, e.g. ["bio 1", "bio 2", "bio 3"].`;

  // 1. Try Gemini API if key is present
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
          }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3);
        }
      }
    } catch {
      // Fall through to fallback generator
    }
  }

  // 2. Try OpenAI API if key is present
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: systemPrompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const list = parsed.bios || parsed.options || Object.values(parsed)[0];
          if (Array.isArray(list)) return list.slice(0, 3);
        }
      }
    } catch {
      // Fall through to fallback generator
    }
  }

  // 3. Fallback Heuristic Generator
  const name = req.name || 'Creator';
  const niche = req.niche ? req.niche.trim() : 'building cool things online';

  if (req.tone === 'professional') {
    return [
      `💼 ${name} • ${niche}. Helping teams and individuals scale with smart digital tools. Let's connect below!`,
      `Founder & specialist in ${niche}. Sharing curated resources, tools & case studies 🚀`,
      `Building the future of ${niche}. Explore my latest projects, articles, and favorite tools 👇`,
    ];
  } else if (req.tone === 'creative') {
    return [
      `🎨 ${name} | Creating magic with ${niche}. Turning ideas into reality one pixel at a time ✨`,
      `Lost in the world of ${niche} & design. Check out my latest work and creations below 🔮`,
      `Design • Build • Share. Exploring ${niche} and sharing the process with you 🌿`,
    ];
  } else if (req.tone === 'bold') {
    return [
      `⚡ ${name} • Dominating the ${niche} space. No fluff, just high-impact results. Dive in below! 🔥`,
      `Obsessed with ${niche}. If it doesn't challenge you, it won't change you. Check my links 👇`,
      `Breaking boundaries in ${niche}. See what I'm building next 🚀`,
    ];
  } else if (req.tone === 'minimalist') {
    return [
      `${name} — ${niche}. Projects, tools and writing linked below.`,
      `Curating ${niche}. Simple, intentional digital work.`,
      `${niche} enthusiast. Connect with me across platforms below.`,
    ];
  }

  // Default casual
  return [
    `👋 Hey, I'm ${name}! Passionate about ${niche}. Tap below to explore my favorite links and tools! ✨`,
    `Sharing my journey in ${niche} 🌟 Digital creator, builder, and lifelong learner.`,
    `Coffee, curiosity & ${niche} ☕ All my latest projects, tools and socials in one place 👇`,
  ];
}

/**
 * Generates an aesthetic, accessible ThemeConfig from a creative prompt.
 */
export async function generateAITheme(prompt: string): Promise<ThemeConfig> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const p = prompt.toLowerCase();

  // If Gemini API is configured, use LLM
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate a cohesive color palette for a Linktree profile based on prompt: "${prompt}".
Return a JSON object with:
- "theme": "ai-theme"
- "background_type": "color" or "gradient"
- "background_value": valid hex code or linear-gradient string
- "card_style": one of "rounded", "pill", "shadow", "glass", "outline"
- "card_color": hex or rgba (must have good contrast with background)
- "text_color": hex (must have high contrast with card_color and background)
- "accent_color": vibrant hex for highlights
- "font": one of "sans", "serif", "mono"`,
                  },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) return JSON.parse(raw) as ThemeConfig;
      }
    } catch {
      // Fall through
    }
  }

  // Semantic heuristic fallback palettes
  if (p.includes('neon') || p.includes('cyber') || p.includes('hacker') || p.includes('matrix')) {
    return {
      theme: 'cyber-neon',
      background_type: 'gradient',
      background_value: 'linear-gradient(135deg, #050505 0%, #0d1117 50%, #161b22 100%)',
      card_style: 'glass',
      card_color: 'rgba(34, 197, 94, 0.08)',
      text_color: '#f0fdf4',
      accent_color: '#22c55e',
      font: 'mono',
    };
  }

  if (p.includes('pastel') || p.includes('cute') || p.includes('soft') || p.includes('anime')) {
    return {
      theme: 'soft-pastel',
      background_type: 'gradient',
      background_value: 'linear-gradient(135deg, #fed7aa 0%, #fbcfe8 50%, #e9d5ff 100%)',
      card_style: 'rounded',
      card_color: 'rgba(255, 255, 255, 0.95)',
      text_color: '#4c1d95',
      accent_color: '#ec4899',
      font: 'sans',
    };
  }

  if (p.includes('gold') || p.includes('luxury') || p.includes('royal') || p.includes('premium')) {
    return {
      theme: 'luxury-gold',
      background_type: 'gradient',
      background_value: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
      card_style: 'outline',
      card_color: '#18181b',
      text_color: '#fafafa',
      accent_color: '#eab308',
      font: 'serif',
    };
  }

  if (p.includes('nature') || p.includes('earth') || p.includes('coffee') || p.includes('organic')) {
    return {
      theme: 'earthy-warmth',
      background_type: 'color',
      background_value: '#292524',
      card_style: 'rounded',
      card_color: '#44403c',
      text_color: '#fafaf9',
      accent_color: '#d97706',
      font: 'serif',
    };
  }

  // Default vibrant modern
  return {
    theme: 'modern-vibrant',
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
    card_style: 'glass',
    card_color: 'rgba(255, 255, 255, 0.12)',
    text_color: '#ffffff',
    accent_color: '#a855f7',
    font: 'sans',
  };
}

/**
 * Scrapes metadata from a URL and suggests an appropriate emoji icon.
 */
export async function scrapeLinkMetadata(rawUrl: string): Promise<SmartLinkMetadata> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  // Domain-based smart emoji detection
  let icon = '🔗';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('github')) icon = '💻';
    else if (host.includes('youtube')) icon = '🎬';
    else if (host.includes('spotify') || host.includes('apple.com/music')) icon = '🎵';
    else if (host.includes('twitter') || host.includes('x.com')) icon = '🐦';
    else if (host.includes('instagram')) icon = '📸';
    else if (host.includes('linkedin')) icon = '💼';
    else if (host.includes('substack') || host.includes('medium')) icon = '✍️';
    else if (host.includes('store') || host.includes('shop') || host.includes('amazon') || host.includes('etsy')) icon = '🛍️';
    else if (host.includes('discord')) icon = '💬';
    else if (host.includes('podcast')) icon = '🎙️';
    else if (host.includes('gumroad') || host.includes('patreon')) icon = '🎁';
  } catch {
    // Keep default icon
  }

  try {
    // Fetch HTML with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { title: new URL(url).hostname.replace(/^www\./, ''), icon };
    }

    const html = await res.text();

    // Match <title> or <meta property="og:title">
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const title = (ogTitleMatch?.[1] || titleMatch?.[1] || new URL(url).hostname.replace(/^www\./, ''))
      .trim()
      .slice(0, 80);

    return { title, icon };
  } catch {
    // If fetch failed, return host as title
    try {
      return { title: new URL(url).hostname.replace(/^www\./, ''), icon };
    } catch {
      return { title: 'External Link', icon };
    }
  }
}
