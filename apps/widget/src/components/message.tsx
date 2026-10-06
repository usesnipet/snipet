import type { ReactNode } from "react";

export function Message({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  return (
    <p className={`sw-message sw-${role}`} part={`message ${role}`}>
      {children}
    </p>
  );
}
