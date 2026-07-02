// The learner's notebook — writing is the visible averaging operation.
// Markdown with preview; clips arrive as quotes with citations.

import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function Notebook({
  initial,
  clipSignal,
  onChange,
}: {
  initial: string;
  /** Incremented + text appended externally when the learner clips a quote. */
  clipSignal: { count: number; text: string };
  onChange: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (clipSignal.count === 0) return;
    setText((t) => {
      const next = t.length > 0 ? `${t.trimEnd()}\n\n${clipSignal.text}` : clipSignal.text;
      onChange(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipSignal.count]);

  const html = preview ? DOMPurify.sanitize(marked.parse(text, { async: false })) : '';

  return (
    <section className="notebook" aria-label="Notebook">
      <header className="notebook-head">
        <span className="pane-title">Notebook</span>
        <div className="notebook-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)}>
            Preview
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const blob = new Blob([text], { type: 'text/markdown' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'kido-notes.md';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export .md
          </button>
        </div>
      </header>
      {preview ? (
        <div className="notebook-preview" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <textarea
          className="notebook-editor"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={'Your synthesis, in your words. Clips land here with their citations.\n\nMarkdown works.'}
        />
      )}
    </section>
  );
}
