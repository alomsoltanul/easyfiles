import React from 'react';
import Link from 'next/link';
import { toolByHref, TOOLS, type Tool } from '@/lib/tools';
import type { ThemeConfig } from '@/lib/supabase/database.types';

interface FeaturedToolCardProps {
  toolSlug: string;
  theme: ThemeConfig;
}

export default function FeaturedToolCard({ toolSlug, theme }: FeaturedToolCardProps) {
  // Normalize slug to match tool href
  const normalizedHref = toolSlug.startsWith('/') ? toolSlug : `/${toolSlug}`;
  let tool: Tool | undefined = toolByHref(normalizedHref);

  if (!tool) {
    // Try matching by ending
    tool = TOOLS.find((t) => t.href.endsWith(toolSlug) || t.href.includes(toolSlug));
  }

  if (!tool) return null;

  return (
    <div
      className="w-full my-3 p-4 rounded-2xl border transition-all duration-200"
      style={{
        backgroundColor: theme.card_style === 'glass' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)',
        borderColor: theme.accent_color,
        color: theme.text_color,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
          style={{
            backgroundColor: `${theme.accent_color}25`,
            color: theme.accent_color,
          }}
        >
          Featured Tool
        </span>
        <span className="text-xs opacity-60">100% Free • In Browser</span>
      </div>

      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${theme.accent_color}20`, color: theme.accent_color }}
        >
          <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-base truncate">{tool.label}</h4>
          <p className="text-xs opacity-80 line-clamp-2 mt-0.5 leading-relaxed">
            {tool.description}
          </p>
        </div>
      </div>

      <Link
        href={tool.href}
        className="mt-3.5 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all duration-150 transform hover:scale-[1.01] active:scale-[0.99] shadow-sm"
        style={{
          backgroundColor: theme.accent_color,
          color: '#ffffff',
        }}
      >
        <span>Open {tool.label}</span>
        <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
