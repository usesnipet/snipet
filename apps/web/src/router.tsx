import { Role } from "@snipet/shared";
import { lazy, Suspense } from "react";
import { createBrowserRouter, createRoutesFromElements, Outlet, Route } from "react-router";
import { RouterProvider } from "react-router/dom";

import { RouteError } from "./components/error-fallback";
import { RequireAuth } from "./components/require-auth";
import { RequireRole } from "./components/require-role";
import { SnipetLoader } from "./components/snipet-loader";
import { SettingsProvider } from "./context/settings-provider";
import { ROUTES } from "./routes";

import type { RoutePath } from "./routes";
const Layout = lazy(() => import("./routes/layout").then((m) => ({ default: m.Layout })));
const LoginPage = lazy(() => import("./routes/login/page").then((m) => ({ default: m.LoginPage })));
const AgentsPage = lazy(() => import("./routes/agents/page").then((m) => ({ default: m.AgentsPage })));
const AgentEditorPage = lazy(() => import("./routes/agents/editor/page").then((m) => ({ default: m.AgentEditorPage })));
const ChatPage = lazy(() => import("./routes/chat/page").then((m) => ({ default: m.ChatPage })));
const LlmConnectionsPage = lazy(() =>
  import("./routes/llm-connections/page").then((m) => ({ default: m.LlmConnectionsPage })),
);
const PluginsPage = lazy(() => import("./routes/plugins/page").then((m) => ({ default: m.PluginsPage })));
const AppsPage = lazy(() => import("./routes/apps/page").then((m) => ({ default: m.AppsPage })));
const UsersPage = lazy(() => import("./routes/users/page").then((m) => ({ default: m.UsersPage })));
const NotFoundPage = lazy(() => import("./routes/not-found/page").then((m) => ({ default: m.NotFoundPage })));

const toReactRouterPath = (path: RoutePath) => {
  return path.replaceAll(/{([^}]+)}/g, (_, p1) => `:${p1}`);
};

/** A data router, because blocking navigation (useBlocker) doesn't work under BrowserRouter. */
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      element={
        <Suspense fallback={<SnipetLoader className="min-h-svh" />}>
          <Outlet />
        </Suspense>
      }
      errorElement={<RouteError className="min-h-svh" />}
    >
      <Route path={toReactRouterPath(ROUTES.login)} element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<SettingsProvider />}>
          {/* One optional-param route, so starting a chat doesn't remount the page. */}
          <Route path={`${toReactRouterPath(ROUTES.chatSession)}?`} element={<ChatPage />} />
          <Route element={<Layout />}>
            {/* Catches errors below the layout, so the sidebar stays usable around the error. */}
            <Route errorElement={<RouteError />}>
              <Route element={<RequireRole role={Role.Admin} />}>
                <Route path={toReactRouterPath(ROUTES.llmConnections)} element={<LlmConnectionsPage />} />
                <Route path={toReactRouterPath(ROUTES.agents)} element={<AgentsPage />} />
                <Route path={toReactRouterPath(ROUTES.agentNew)} element={<AgentEditorPage />} />
                <Route path={toReactRouterPath(ROUTES.agent)} element={<AgentEditorPage />} />
                <Route path={toReactRouterPath(ROUTES.plugins)} element={<PluginsPage />} />
                <Route path={toReactRouterPath(ROUTES.apps)} element={<AppsPage />} />
                <Route path={toReactRouterPath(ROUTES.users)} element={<UsersPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
    </Route>,
  ),
);

export const Router = () => <RouterProvider router={router} />;
