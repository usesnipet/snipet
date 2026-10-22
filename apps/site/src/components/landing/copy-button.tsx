import { useState } from "react";

/** Copies `code` to the clipboard and confirms for a moment. */
export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md px-2 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
