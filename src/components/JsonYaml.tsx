'use client';

import React, { useState } from 'react';
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

export default function JsonYaml() {
  const [tab, setTab] = useState<YamlTab>('json-to-yaml');
  const [jsonInput, setJsonInput] = useState('');
  const [yamlInput, setYamlInput] = useState('');
  const [yamlOutput, setYamlOutput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJsonChange = async (val: string) => {
    setJsonInput(val);
    setError(null);
    if (!val.trim()) { setYamlOutput(''); return; }
    setLoading(true);
    try {
      const obj = JSON.parse(val);
      const yaml = await loadYaml();
      setYamlOutput(yaml.dump(obj, { indent: 2, lineWidth: 120, noRefs: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      setYamlOutput('');
    } finally {
      setLoading(false);
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

      {loading && <p className="text-sm text-slate-500">Converting...</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        {tab === 'json-to-yaml' ? (
          <>
            <CodeEditor value={jsonInput} onChange={handleJsonChange} placeholder='Paste JSON, e.g. {"name":"John"}' label="JSON Input" error={error} rows={12} />
            {yamlOutput && <CodeOutput value={yamlOutput} label="YAML Output" downloadFileName="output.yaml" />}
          </>
        ) : (
          <>
            <CodeEditor value={yamlInput} onChange={handleYamlChange} placeholder={"Paste YAML, e.g.\nname: John"} label="YAML Input" error={error} rows={12} />
            {jsonOutput && <CodeOutput value={jsonOutput} label="JSON Output" downloadFileName="output.json" />}
          </>
        )}
      </div>
    </div>
  );
}
