import { ErrorFallback } from "@/components/error-fallback";
import { SnipetLoader } from "@/components/snipet-loader";
import { useSettings } from "@snipet/client";
import { Outlet } from "react-router";

import { SettingsContext } from "./settings-context";

/** Loads the system settings once signed in (the endpoint needs auth) and holds the child routes until they arrive. */
export function SettingsProvider() {
  const { data, error } = useSettings();

  if (error) return <ErrorFallback error={error} className="min-h-svh" />;
  if (!data) return <SnipetLoader className="min-h-svh" />;

  return (
    <SettingsContext.Provider value={data}>
      <Outlet />
    </SettingsContext.Provider>
  );
}
