import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useState } from "react";

export function Widget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-ink font-sans fixed right-4 bottom-4 z-2147483647 flex flex-col items-end gap-3 text-sm">
      {open && (
        <div className="bg-paper flex h-[min(560px,calc(100vh-6rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-black/10 shadow-2xl sm:w-[380px]">
          <header className="bg-ink text-paper flex items-center justify-between px-4 py-3">
            <span className="font-semibold">Chat</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="cursor-pointer rounded-md p-1 hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex flex-1 items-center justify-center p-4 text-black/50">
            How can I help you?
          </div>

          <form
            onSubmit={(event) => event.preventDefault()}
            className="flex items-center gap-2 border-t border-black/10 p-3"
          >
            <input
              placeholder="Type a message…"
              className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-accent"
            />
            <button
              type="submit"
              aria-label="Send"
              className="bg-accent cursor-pointer rounded-lg p-2 text-white hover:opacity-90"
            >
              <SendHorizontal className="size-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        className="bg-accent flex size-14 cursor-pointer items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
