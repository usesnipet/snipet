import { useSettings } from "@snipet/client";
import { Outlet } from "react-router";

import { ErrorFallback } from "@/components/error-fallback";
import { LoadingFallback } from "@/components/loading-fallback";

import { SettingsContext } from "./settings-context";

// Loads the system settings once the user is signed in (the endpoint needs
// auth) and holds the routes below until they arrive.
export function SettingsProvider() {
  const { data, error } = useSettings();

  if (error) return <ErrorFallback error={error} />;
  if (!data) return <LoadingFallback className="min-h-svh" />;

  return (
    <SettingsContext.Provider value={data}>
      <Outlet />
    </SettingsContext.Provider>
  );
}
