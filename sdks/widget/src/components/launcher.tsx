import { MessageCircle, X } from "lucide-react";

export function Launcher({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Close chat" : "Open chat"}
      aria-expanded={open}
      className="sw-launcher"
      part="launcher"
    >
      {open ? <X className="sw-icon" /> : <MessageCircle className="sw-icon" />}
    </button>
  );
}
