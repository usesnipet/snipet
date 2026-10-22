import { useState } from "react";

import { CopyButton } from "../copy-button";

/** A code sample with its markup already highlighted on the server. */
export type HighlightedSnippet = { caption: string; code: string; html: string };

export function SnippetTabs({ snippets }: { snippets: HighlightedSnippet[] }) {
  const [active, setActive] = useState(0);
  const current = snippets[active];

  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-[#24292e]">
      <div className="flex items-center justify-between border-b border-white/10 px-2" role="tablist" aria-label="Embed options">
        <div className="flex">
          {snippets.map((s, i) => (
            <button
              key={s.caption}
              type="button"
              role="tab"
              id={`snippet-tab-${i}`}
              aria-selected={i === active}
              aria-controls="snippet-panel"
              onClick={() => setActive(i)}
              className={`border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
                i === active ? "border-primary text-white" : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              {s.caption}
            </button>
          ))}
        </div>
        <CopyButton code={current.code} className="text-white/60 hover:bg-white/10 hover:text-white" />
      </div>
      <div
        id="snippet-panel"
        role="tabpanel"
        aria-labelledby={`snippet-tab-${active}`}
        // Fixed height so switching tabs doesn't move the page; long samples scroll inside.
        className="h-80 overflow-auto [&_pre]:min-h-full [&_pre]:p-4 [&_pre]:text-sm"
        dangerouslySetInnerHTML={{ __html: current.html }}
      />
    </div>
  );
}
