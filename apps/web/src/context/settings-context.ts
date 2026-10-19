import * as React from "react";

import type { Settings } from "@snipet/shared";

export const SettingsContext = React.createContext<Settings | undefined>(undefined);

export function useSystemSettings() {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSystemSettings must be used within a SettingsProvider");
  }
  return context;
}
