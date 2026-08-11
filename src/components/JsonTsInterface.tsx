'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

const VALID_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function quoteKey(k: string): string {
  return VALID_KEY.test(k) ? k : JSON.stringify(k);
}

type Ctx = { collected: Map<string, string>; counter: { n: number } };

function inferType(value: unknown, suggestedName: string, indent: string, ctx: Ctx): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    const itemTypes = value.map((v) => inferType(v, suggestedName, indent, ctx));
    const unique = [...new Set(itemTypes)];
    if (unique.length === 1) return `${unique[0]}[]`;
    return `(${unique.join(' | ')})[]`;
  }
  if (typeof value === 'object') {
    return inferObject(value as Record<string, unknown>, suggestedName, indent, ctx);
  }
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unknown';
}

function inferObject(obj: Record<string, unknown>, name: string, indent: string, ctx: Ctx): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return 'Record<string, unknown>';
  const next = indent + '  ';
  const fields = entries.map(([key, value]) => {
    const optional = value === null;
    const type = inferType(value, key, next, ctx);
    return `${next}${quoteKey(key)}${optional ? '?' : ''}: ${type};`;
  });
  return `{\n${fields.join('\n')}\n${indent}}`;
}

function generate(rootName: string, data: unknown, keyword: 'interface' | 'type'): string {
  const ctx: Ctx = { collected: new Map(), counter: { n: 0 } };
  if (Array.isArray(data)) {
    const itemType = inferType(data[0] ?? {}, rootName, '', ctx);
    return `export ${keyword} ${rootName} ${keyword === 'type' ? '= ' : ''}${itemType}[]${keyword === 'type' ? ';' : ''}`;
  }
  if (data === null || typeof data !== 'object') {
    const t = inferType(data, rootName, '', ctx);
    return `export type ${rootName} = ${t};`;
  }
  const body = inferObject(data as Record<string, unknown>, rootName, '', ctx);
  if (keyword === 'interface') return `export interface ${rootName} ${body}`;
  return `export type ${rootName} = ${body};`;
}

export default function JsonTsInterface() {
  const [input, setInput] = useState('');
  const [interfaceName, setInterfaceName] = useState('Root');
  const [useType, setUseType] = useState(false);

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null };
    try {
      const obj = JSON.parse(input);
      const safeName = interfaceName.trim() || 'Root';
      return { output: generate(safeName, obj, useType ? 'type' : 'interface'), error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [input, interfaceName, useType]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input
            type="text"
            value={interfaceName}
            onChange={(e) => setInterfaceName(e.target.value)}
            className="w-40 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-400"
          />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={() => setUseType(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${!useType ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            interface
          </button>
          <button
            onClick={() => setUseType(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${useType ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            type
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <CodeEditor
          value={input}
          onChange={setInput}
          placeholder='Paste JSON, e.g. {"name":"John","age":30,"items":[{"id":1}]}'
          label="JSON Input"
          error={error}
          rows={12}
        />

        {output && (
          <CodeOutput value={output} label="TypeScript Output" languageLabel="typescript" downloadFileName={`${interfaceName}.ts`} />
        )}
      </div>
    </div>
  );
}
