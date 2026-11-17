import { SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

/** Message input; calls onSend with the trimmed text and clears itself. */
export function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const text = input.trim();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!text || disabled) return;
        setInput("");
        onSend(text);
        // Clicking send moves focus to the button, which then disables and drops it.
        inputRef.current?.focus();
      }}
      className="sw-composer"
      part="composer"
    >
      <input
        ref={inputRef}
        autoFocus
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Type a message..."
        className="sw-input"
        part="input"
      />
      <button type="submit" disabled={disabled || !text} aria-label="Send" className="sw-send" part="send">
        <SendHorizontal className="sw-icon" />
      </button>
    </form>
  );
}
