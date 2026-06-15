'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

function generateTsInterface(name: string, data: unknown, indent: string = ''): string {
  if (data === null) return `${indent}null`;
  if (data instanceof Array) {
    if (data.length === 0) return `${indent}unknown[]`;
    const types = data.map((item) => generateTsInterface('', item, ''));
    const unique = [...new Set(types)];
    const inner = unique.length === 1 ? unique[0] : unique.join(' | ');
    return `${indent}(${inner})[]`;
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return `${indent}{}`;
    const fields = entries.map(([key, value]) => {
      const type = generateTsInterface(key, value, '');
      const optional = key.includes('_') || false;
      return `${indent}  ${key}${optional ? '?' : ''}: ${type};`;
    });
    return `{\n${fields.join('\n')}\n${indent}}`;
  }
  return `${indent}${typeof data}`;
}

export default function JsonTsInterface() {
  const [input, setInput] = useState('');
  const [interfaceName, setInterfaceName] = useState('Root');
  const [useType, setUseType] = useState(false);

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null };
    try {
      const obj = JSON.parse(input);
      const keyword = useType ? 'type' : 'interface';
      const body = generateTsInterface(interfaceName, obj, '  ');
      if (body.startsWith('{')) {
        return { output: `export ${keyword} ${interfaceName} ${body}`, error: null };
      }
      return { output: `export ${keyword} ${interfaceName} = ${body};`, error: null };
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
  );
}
