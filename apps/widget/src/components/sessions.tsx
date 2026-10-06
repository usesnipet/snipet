import { useListSessions } from "@snipet/client";

import { Empty } from "./empty";

export function Sessions({ activeId, onPick }: { activeId?: string; onPick: (id: string) => void }) {
  const sessions = useListSessions();

  if (sessions.isLoading) return <Empty>Loading…</Empty>;
  if (sessions.error) return <Empty>{sessions.error.message}</Empty>;
  if (!sessions.data?.data.length) return <Empty>No chats yet.</Empty>;

  return (
    <ul className="sw-body sw-sessions" part="sessions">
      {sessions.data.data.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onPick(session.id)}
            aria-current={session.id === activeId}
            className="sw-session"
            part="session"
          >
            {session.title || "New chat"}
          </button>
        </li>
      ))}
    </ul>
  );
}
