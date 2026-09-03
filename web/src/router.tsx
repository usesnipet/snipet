import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import { LoadingFallback } from "./components/loading-fallback";
import { ROUTES } from "./routes";

import type { RoutePath } from "./routes";

const Layout = lazy(() =>
  import("./routes/layout").then((m) => ({ default: m.Layout })));
const HomePage = lazy(() =>
  import("./routes/page").then((m) => ({ default: m.HomePage })));

const toReactRouterPath = (path: RoutePath) => {
  return path.replaceAll(/{([^}]+)}/g, (_, p1) => `:${p1}`);
}

export const Router = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback className="min-h-svh" />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path={toReactRouterPath(ROUTES.home)} element={<HomePage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
