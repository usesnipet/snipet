import { usePublicApp } from "@snipet/client";
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
  const full = config.size === "full";
  const setOpen = (value: boolean) => widgetStore.set({ open: value });

  const [view, setView] = useState<View>("chat");
  const [sessionId, setSessionId] = useState<string>();
  const ready = !!config.token && !!config.agentId;
  const { data: app } = usePublicApp(config.appId);

  return (
    <>
      {/* Custom CSS comes after the base <style>, so it wins at equal specificity. */}
      {config.cssUrl && <link rel="stylesheet" href={config.cssUrl} />}
      {config.css && <style>{config.css}</style>}

      {config.enabled && (
        <div className={full ? "sw-root sw-full" : "sw-root"} part="root">
          {/* Before the panel so the panel paints on top of it. */}
          {open && full && <div className="sw-backdrop" part="backdrop" onClick={() => setOpen(false)} />}

          {open && (
            <div className="sw-panel" part="panel">
              <Header
                view={view}
                title={app?.name}
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

          {!(open && full) && <Launcher open={open} onToggle={() => setOpen(!open)} />}
        </div>
      )}
    </>
  );
}
