import type { ComponentType } from "react";
import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/app-layout";
import { LoginPage } from "./pages/login/page";

const lazyPage = (importFn: () => Promise<Record<string, ComponentType>>, name: string) =>
  lazy(() => importFn().then((module) => ({ default: module[name] })));

const HomePage = lazyPage(() => import("./pages/page"), "HomePage");
const SettingsPage = lazyPage(() => import("./pages/settings/page"), "SettingsPage");

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
