import { useState } from "react";

import { Chat } from "./components/chat";
import { Empty } from "./components/empty";
import { Header } from "./components/header";
import { Launcher } from "./components/launcher";
import { Sessions } from "./components/sessions";
import { useWidgetConfig, widgetStore } from "./config";

import type { View } from "./components/header";

// `part` attributes let the host page style pieces with snipet-widget::part(name).
export function Widget() {
  const config = useWidgetConfig();
  const { open } = config;
  const setOpen = (value: boolean) => widgetStore.set({ open: value });

  const [view, setView] = useState<View>("chat");
  const [sessionId, setSessionId] = useState<string>();
  const ready = !!config.token && !!config.agentId;

  return (
    <>
      {/* Custom CSS comes after the base <style>, so it wins at equal specificity. */}
      {config.cssUrl && <link rel="stylesheet" href={config.cssUrl} />}
      {config.css && <style>{config.css}</style>}

      {config.enabled && (
        <div className="sw-root" part="root">
          {open && (
            <div className="sw-panel" part="panel">
              <Header
                view={view}
                ready={ready}
                onToggleHistory={() => setView(view === "sessions" ? "chat" : "sessions")}
                onNewChat={() => {
                  setSessionId(undefined);
                  setView("chat");
                }}
                onClose={() => setOpen(false)}
              />

              {!config.token ? (
                <Empty>Sign in to chat.</Empty>
              ) : !config.agentId ? (
                <Empty>This chat isn't set up yet.</Empty>
              ) : view === "sessions" ? (
                <Sessions
                  activeId={sessionId}
                  onPick={(id) => {
                    setSessionId(id);
                    setView("chat");
                  }}
                />
              ) : (
                <Chat agentId={config.agentId} sessionId={sessionId} onSessionStarted={setSessionId} />
              )}
            </div>
          )}

          <Launcher open={open} onToggle={() => setOpen(!open)} />
        </div>
      )}
    </>
  );
}
