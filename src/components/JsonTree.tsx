'use client';

import React, { useState, useCallback } from 'react';

interface JsonTreeProps {
  data: unknown;
  rootName?: string;
  defaultExpanded?: boolean;
  maxDepth?: number;
}

function JsonNode({ name, value, depth, maxDepth, defaultExpanded }: {
  name?: string;
  value: unknown;
  depth: number;
  maxDepth: number;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < maxDepth);

  if (value === null) return <JsonLeaf name={name} value="null" type="null" />;
  if (typeof value === 'boolean') return <JsonLeaf name={name} value={value.toString()} type="boolean" />;
  if (typeof value === 'number') return <JsonLeaf name={name} value={value.toString()} type="number" />;
  if (typeof value === 'string') return <JsonLeaf name={name} value={`"${value}"`} type="string" />;

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => ({ key: String(i), val: v }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, val: v }));

  const isEmpty = entries.length === 0;
  const bracket = isArray ? ['[', ']'] : ['{', '}'];

  if (isEmpty || !expanded) {
    return (
      <div className="font-mono text-sm leading-6 flex items-center gap-1 ml-4">
        <button onClick={() => !isEmpty && setExpanded(true)} className="text-slate-400 hover:text-slate-600 w-4 flex-shrink-0">
          {isEmpty ? <span className="text-slate-300">·</span> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
        </button>
        {name !== undefined && <span className="text-slate-600">{name}<span className="text-slate-400">: </span></span>}
        <span className="text-slate-400">{bracket[0]}</span>
        {!isEmpty && <span className="text-slate-400 cursor-pointer" onClick={() => setExpanded(true)}>{entries.length} {isArray ? 'items' : 'keys'} {bracket[1]}</span>}
        {isEmpty && <span className="text-slate-400">{bracket[1]}</span>}
      </div>
    );
  }

  return (
    <div className="ml-4">
      <div className="font-mono text-sm leading-6 flex items-center gap-1">
        <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600 w-4 flex-shrink-0">
          <svg className="w-3 h-3 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        {name !== undefined && <span className="text-slate-600">{name}<span className="text-slate-400">: </span></span>}
        <span className="text-slate-400">{bracket[0]}</span>
      </div>
      {entries.map(({ key, val }) => (
        <JsonNode key={key} name={isArray ? undefined : key} value={val} depth={depth + 1} maxDepth={maxDepth} defaultExpanded={defaultExpanded} />
      ))}
      <div className="font-mono text-sm leading-6 ml-4">
        <span className="text-slate-400">{bracket[1]}</span>
      </div>
    </div>
  );
}

function JsonLeaf({ name, value, type }: { name?: string; value: string; type: string }) {
  const colors: Record<string, string> = {
    null: 'text-slate-400',
    boolean: 'text-amber-600',
    number: 'text-blue-600',
    string: 'text-emerald-600',
  };

  return (
    <div className="font-mono text-sm leading-6 ml-4">
      {name !== undefined && <span className="text-slate-600">{name}<span className="text-slate-400">: </span></span>}
      <span className={colors[type] || 'text-slate-600'}>{value}</span>
    </div>
  );
}

export default function JsonTree({ data, rootName = 'root', defaultExpanded = true, maxDepth = 10 }: JsonTreeProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tree View</span>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        <JsonNode name={rootName} value={data} depth={0} maxDepth={maxDepth} defaultExpanded={defaultExpanded} />
      </div>
    </div>
  );
}
