import type { ReactNode } from "react";

/** Centered placeholder filling the panel body: loading, errors, empty states. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="sw-body sw-empty" part="body">
      {children}
    </div>
  );
}
