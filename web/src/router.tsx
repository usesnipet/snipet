import type { ComponentType } from "react";
import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const lazyPage = (importFn: () => Promise<Record<string, ComponentType>>, name: string) =>
  lazy(() => importFn().then((module) => ({ default: module[name] })));

const AppLayout = lazyPage(() => import("./pages/app/app-layout"), "AppLayout");
const AuthLayout = lazyPage(() => import("./pages/auth/layout"), "AuthLayout");
const HomePage = lazyPage(() => import("./pages/app/page"), "HomePage");
const SettingsPage = lazyPage(() => import("./pages/app/settings/page"), "SettingsPage");
const LoginPage = lazyPage(() => import("./pages/auth/login/page"), "LoginPage");
const RegisterPage = lazyPage(() => import("./pages/auth/register/page"), "RegisterPage");

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
