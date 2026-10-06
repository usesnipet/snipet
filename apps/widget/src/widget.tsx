import { MessageCircle, SendHorizontal, X } from "lucide-react";

import { useWidgetConfig, widgetStore } from "./config";

// `part` attributes let the host page style pieces with snipet-widget::part(name).
export function Widget() {
  const config = useWidgetConfig();
  const { open } = config;
  const setOpen = (value: boolean) => widgetStore.set({ open: value });

  return (
    <>
      {/* Custom CSS comes after the base <style>, so it wins at equal specificity. */}
      {config.cssUrl && <link rel="stylesheet" href={config.cssUrl} />}
      {config.css && <style>{config.css}</style>}

      {config.enabled && (
        <div className="sw-root" part="root">
          {open && (
            <div className="sw-panel" part="panel">
              <header className="sw-header" part="header">
                <span className="sw-title">Chat</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="sw-icon-button"
                >
                  <X className="sw-icon" />
                </button>
              </header>

              <div className="sw-body" part="body">How can I help you?</div>

              <form onSubmit={(event) => event.preventDefault()} className="sw-composer" part="composer">
                <input placeholder="Type a message..." className="sw-input" part="input" />
                <button type="submit" aria-label="Send" className="sw-send" part="send">
                  <SendHorizontal className="sw-icon" />
                </button>
              </form>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close chat" : "Open chat"}
            aria-expanded={open}
            className="sw-launcher"
            part="launcher"
          >
            {open ? <X className="sw-icon" /> : <MessageCircle className="sw-icon" />}
          </button>
        </div>
      )}
    </>
  );
}
