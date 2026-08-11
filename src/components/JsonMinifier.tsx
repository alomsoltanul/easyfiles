'use client';

import React, { useState, useMemo } from 'react';
import CodeEditor from './CodeEditor';
import CodeOutput from './CodeOutput';
import SizeComparison from './SizeComparison';

export default function JsonMinifier() {
  const [input, setInput] = useState('');

  const { minified, error } = useMemo(() => {
    if (!input.trim()) return { minified: '', error: null };
    try {
      const obj = JSON.parse(input);
      return { minified: JSON.stringify(obj), error: null };
    } catch (e) {
      return { minified: '', error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [input]);

  const originalSize = new Blob([input]).size;
  const minifiedSize = new Blob([minified]).size;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <CodeEditor
          value={input}
          onChange={setInput}
          placeholder="Paste JSON to minify..."
          label="JSON Input"
          error={error}
          rows={12}
        />

        {minified && (
          <CodeOutput
            value={minified}
            label="Minified JSON"
            downloadFileName="minified.json"
          />
        )}
      </div>

      {minified && (
        <SizeComparison originalSize={originalSize} convertedSize={minifiedSize} />
      )}
    </div>
  );
}
