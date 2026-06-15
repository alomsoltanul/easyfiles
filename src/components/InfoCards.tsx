import React from 'react';

type CardColor = 'blue' | 'violet' | 'amber' | 'emerald';

interface InfoCard {
  color: CardColor;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface InfoCardsProps {
  cards: InfoCard[];
}

const colorMap: Record<CardColor, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
};

export default function InfoCards({ cards }: InfoCardsProps) {
  return (
    <div className="grid sm:grid-cols-3 gap-4 mt-8">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className={`w-10 h-10 rounded-lg ${colorMap[card.color].bg} flex items-center justify-center mb-3`}>
            <span className={colorMap[card.color].text}>{card.icon}</span>
          </div>
          <h3 className="font-semibold text-slate-800 text-sm mb-1">{card.title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
        </div>
      ))}
    </div>
  );
}

export function PrivacyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export function SpeedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export function BulkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
