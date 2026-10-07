import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import type { Components } from "react-markdown";

// Same plugins as the web app's markdown. Raw HTML in model output stays text
// (no rehype-raw), and links open outside the host page.
const remarkPlugins = [remarkGfm, remarkBreaks];
const components: Components = {
  a: ({ node: _, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

// Assistant replies render as markdown; user input stays plain text.
export function Message({ role, children }: { role: "user" | "assistant"; children: string }) {
  return (
    <div className={`sw-message sw-${role}`} part={`message ${role}`}>
      {role === "assistant" ? (
        <Markdown remarkPlugins={remarkPlugins} components={components}>
          {children}
        </Markdown>
      ) : (
        children
      )}
    </div>
  );
}
