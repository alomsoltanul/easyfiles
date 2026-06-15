'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type YamlTab = 'json-to-yaml' | 'yaml-to-json';

let yamlModule: typeof import('js-yaml') | null = null;

async function loadYaml() {
  if (!yamlModule) {
    yamlModule = await import('js-yaml');
  }
  return yamlModule;
}

function jsonToYamlSync(json: string): string {
  const obj = JSON.parse(json);
  let result = '';
  function emit(key: string | null, value: unknown, indent: number) {
    const pad = '  '.repeat(indent);
    if (value === null) {
      result += `${pad}${key}: null\n`;
    } else if (typeof value === 'boolean') {
      result += `${pad}${key}: ${value}\n`;
    } else if (typeof value === 'number') {
      result += `${pad}${key}: ${value}\n`;
    } else if (typeof value === 'string') {
      const needsQuotes = /[:{}\[\],&*#?|\-<>=!%@`]/.test(value[0]) || value.includes(': ') || value.includes('#');
      const val = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
      result += `${pad}${key !== null ? key + ': ' : '-'}${val}\n`;
    } else if (Array.isArray(value)) {
      if (key !== null) result += `${pad}${key}:\n`;
      value.forEach((item) => emit(null, item, indent + 1));
    } else if (typeof value === 'object') {
      if (key !== null) result += `${pad}${key}:\n`;
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) => emit(k, v, indent + 1));
    }
  }
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => emit(null, item, 0));
    } else {
      Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => emit(k, v, 0));
    }
  }
  return result.trimEnd();
}

export default function JsonYaml() {
  const [tab, setTab] = useState<YamlTab>('json-to-yaml');
  const [jsonInput, setJsonInput] = useState('');
  const [yamlInput, setYamlInput] = useState('');
  const [yamlOutput, setYamlOutput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJsonChange = (val: string) => {
    setJsonInput(val);
    setError(null);
    if (!val.trim()) { setYamlOutput(''); return; }
    try {
      setYamlOutput(jsonToYamlSync(val));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      setYamlOutput('');
    }
  };

  const handleYamlChange = async (val: string) => {
    setYamlInput(val);
    setError(null);
    if (!val.trim()) { setJsonOutput(''); return; }
    setLoading(true);
    try {
      const yaml = await loadYaml();
      const obj = yaml.load(val);
      setJsonOutput(JSON.stringify(obj, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid YAML');
      setJsonOutput('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
        {([
          { id: 'json-to-yaml' as YamlTab, label: 'JSON → YAML' },
          { id: 'yaml-to-json' as YamlTab, label: 'YAML → JSON' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'json-to-yaml' ? (
        <>
          <CodeEditor value={jsonInput} onChange={handleJsonChange} placeholder='Paste JSON, e.g. {"name":"John"}' label="JSON Input" error={error} rows={12} />
          {yamlOutput && <CodeOutput value={yamlOutput} label="YAML Output" downloadFileName="output.yaml" />}
        </>
      ) : (
        <>
          <CodeEditor value={yamlInput} onChange={handleYamlChange} placeholder="Paste YAML, e.g.\nname: John" label="YAML Input" error={error} rows={12} />
          {loading && <p className="text-sm text-slate-500">Parsing YAML...</p>}
          {jsonOutput && <CodeOutput value={jsonOutput} label="JSON Output" downloadFileName="output.json" />}
        </>
      )}
    </div>
  );
}
