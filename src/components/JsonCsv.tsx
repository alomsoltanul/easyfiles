'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';

type CsvTab = 'json-to-csv' | 'csv-to-json';

function jsonToCsv(json: string): string {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map((row: Record<string, unknown>) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function csvToJson(csv: string): string {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have at least a header and one data row');

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });

  return JSON.stringify(rows, null, 2);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export default function JsonCsv() {
  const [tab, setTab] = useState<CsvTab>('json-to-csv');
  const [jsonInput, setJsonInput] = useState('');
  const [csvInput, setCsvInput] = useState('');

  const jsonResult = useMemo(() => {
    if (tab !== 'json-to-csv' || !jsonInput.trim()) return { output: '', error: null };
    try {
      return { output: jsonToCsv(jsonInput), error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
    }
  }, [jsonInput, tab]);

  const csvResult = useMemo(() => {
    if (tab !== 'csv-to-json' || !csvInput.trim()) return { output: '', error: null };
    try {
      return { output: csvToJson(csvInput), error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
    }
  }, [csvInput, tab]);

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
        {([
          { id: 'json-to-csv' as CsvTab, label: 'JSON → CSV' },
          { id: 'csv-to-json' as CsvTab, label: 'CSV → JSON' },
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

      {tab === 'json-to-csv' ? (
        <>
          <CodeEditor
            value={jsonInput}
            onChange={setJsonInput}
            placeholder='Paste JSON array, e.g. [{"name":"John","age":30}]'
            label="JSON Input"
            error={jsonResult.error}
            rows={12}
          />
          {jsonResult.output && (
            <CodeOutput value={jsonResult.output} label="CSV Output" downloadFileName="output.csv" />
          )}
        </>
      ) : (
        <>
          <CodeEditor
            value={csvInput}
            onChange={setCsvInput}
            placeholder="Paste CSV, e.g.\nname,age\nJohn,30"
            label="CSV Input"
            error={csvResult.error}
            rows={12}
          />
          {csvResult.output && (
            <CodeOutput value={csvResult.output} label="JSON Output" downloadFileName="output.json" />
          )}
        </>
      )}
    </div>
  );
}
