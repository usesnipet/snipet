import { History, SquarePen, X } from "lucide-react";

export type View = "chat" | "sessions";

export function Header({
  view,
  ready,
  onToggleHistory,
  onNewChat,
  onClose,
}: {
  view: View;
  /** Token and agent are set: history and new chat are usable. */
  ready: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onClose: () => void;
}) {
  return (
    <header className="sw-header" part="header">
      <span className="sw-title">{view === "sessions" ? "Chats" : "Chat"}</span>
      <div className="sw-actions">
        {ready && (
          <>
            <button
              type="button"
              onClick={onToggleHistory}
              aria-label="Chat history"
              aria-pressed={view === "sessions"}
              className="sw-icon-button"
            >
              <History className="sw-icon" />
            </button>
            <button type="button" onClick={onNewChat} aria-label="New chat" className="sw-icon-button">
              <SquarePen className="sw-icon" />
            </button>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Close chat" className="sw-icon-button">
          <X className="sw-icon" />
        </button>
      </div>
    </header>
  );
}
