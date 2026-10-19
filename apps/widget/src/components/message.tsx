import DOMPurify from "dompurify";
import { Marked } from "marked";
import { useMemo } from "react";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// GFM + single newlines as <br>, like the web app's markdown. Raw HTML in model output stays text.
const marked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: { html: ({ text }) => escapeHtml(text) },
});

// Links in model output open outside the host page.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName !== "A") return;
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
});

// Model output is untrusted: DOMPurify also catches what escaping doesn't, like javascript: link URLs.
const toHtml = (markdown: string) => DOMPurify.sanitize(marked.parse(markdown) as string);

// Assistant replies render as markdown; user input stays plain text.
export function Message({ role, children }: { role: "user" | "assistant"; children: string }) {
  const html = useMemo(() => (role === "assistant" ? toHtml(children) : ""), [role, children]);
  return role === "assistant" ? (
    <div className={`sw-message sw-${role}`} part={`message ${role}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div className={`sw-message sw-${role}`} part={`message ${role}`}>
      {children}
    </div>
  );
}
