import React from 'react';

interface ToolLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  infoCards?: React.ReactNode;
}

export default function ToolLayout({ title, description, children, infoCards }: ToolLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">{children}</div>
      </div>

      {infoCards && (
        <div className="grid sm:grid-cols-3 gap-4 mt-8">{infoCards}</div>
      )}
    </div>
  );
}
