import React from 'react';
import type { ProfileLink, ThemeConfig } from '@/lib/supabase/database.types';

interface ProfileLinkCardProps {
  link: ProfileLink;
  theme: ThemeConfig;
}

export default function ProfileLinkCard({ link, theme }: ProfileLinkCardProps) {
  const getCardStyleClasses = () => {
    switch (theme.card_style) {
      case 'pill':
        return 'rounded-full';
      case 'shadow':
        return 'rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5';
      case 'glass':
        return 'rounded-2xl backdrop-blur-md border border-white/20 shadow-sm hover:bg-white/15';
      case 'outline':
        return 'rounded-2xl border-2 hover:bg-white/5';
      case 'rounded':
      default:
        return 'rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5';
    }
  };

  const redirectHref = `/r/${link.id}`;

  const customStyle: React.CSSProperties = {
    color: theme.text_color,
    backgroundColor: theme.card_style === 'outline' ? 'transparent' : theme.card_color,
    borderColor: theme.card_style === 'outline' ? theme.accent_color : undefined,
  };

  return (
    <a
      href={redirectHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex items-center justify-between w-full px-5 py-4 transition-all duration-200 text-center select-none ${getCardStyleClasses()}`}
      style={customStyle}
    >
      <div className="flex items-center gap-3 w-full">
        {link.icon ? (
          <span className="text-xl flex-shrink-0" aria-hidden="true">
            {link.icon}
          </span>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        <span className="font-medium text-base sm:text-lg flex-1 truncate text-center tracking-wide">
          {link.title}
        </span>

        <span
          className="w-5 flex-shrink-0 text-current opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
          aria-hidden="true"
        >
          <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </div>
    </a>
  );
}
