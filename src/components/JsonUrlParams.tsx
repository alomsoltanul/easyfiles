'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type UrlTab = 'params-to-json' | 'json-to-params';

function paramsToJson(params: string): string {
  const usp = new URLSearchParams(params.startsWith('?') ? params.slice(1) : params);
  const obj: Record<string, string> = {};
  usp.forEach((value, key) => { obj[key] = value; });
  return JSON.stringify(obj, null, 2);
}

function jsonToParams(json: string): string {
  const obj = JSON.parse(json);
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('JSON must be an object');
  }
  const params = new URLSearchParams();
  Object.entries(obj as Record<string, string | number | boolean>).forEach(([k, v]) => {
    params.append(k, String(v));
  });
  return params.toString();
}

export default function JsonUrlParams() {
  const [tab, setTab] = useState<UrlTab>('params-to-json');
  const [paramsInput, setParamsInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');

  const paramsResult = useMemo(() => {
    if (tab !== 'params-to-json' || !paramsInput.trim()) return { output: '', error: null };
    try {
      return { output: paramsToJson(paramsInput), error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
    }
  }, [paramsInput, tab]);

  const jsonResult = useMemo(() => {
    if (tab !== 'json-to-params' || !jsonInput.trim()) return { output: '', error: null };
    try {
      return { output: jsonToParams(jsonInput), error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
    }
  }, [jsonInput, tab]);

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
        {([
          { id: 'params-to-json' as UrlTab, label: 'URL Params → JSON' },
          { id: 'json-to-params' as UrlTab, label: 'JSON → URL Params' },
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

      {tab === 'params-to-json' ? (
        <>
          <CodeEditor
            value={paramsInput}
            onChange={setParamsInput}
            placeholder="Paste URL params, e.g. ?name=John&age=30"
            label="URL Params Input"
            error={paramsResult.error}
            rows={8}
          />
          {paramsResult.output && (
            <CodeOutput value={paramsResult.output} label="JSON Output" downloadFileName="params.json" />
          )}
        </>
      ) : (
        <>
          <CodeEditor
            value={jsonInput}
            onChange={setJsonInput}
            placeholder='Paste JSON object, e.g. {"name":"John","age":"30"}'
            label="JSON Input"
            error={jsonResult.error}
            rows={10}
          />
          {jsonResult.output && (
            <CodeOutput value={jsonResult.output} label="URL Params Output" downloadFileName="params.txt" />
          )}
        </>
      )}
    </div>
  );
}
