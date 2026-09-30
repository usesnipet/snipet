import { applyPathParams } from "@/lib/http";
import { logger } from "@/lib/logger";
import { useNavigate as useNavigateReactRouter } from "react-router";

import type { RoutePath } from "@/routes";
import type { NavigateOptions } from "react-router";
type Options = NavigateOptions & {
  params?: Record<string, string>;
}

export const useNavigate = () => {
  const navigate = useNavigateReactRouter();
  return (path: RoutePath | number, options?: Options) => {
    if (typeof path === "number") return navigate(path);
    const {params, ...rest} = options ?? {};
    const pathWithParams = applyPathParams(path, params ?? {});
    if (pathWithParams.includes("{") || pathWithParams.includes("}")) {
      logger.error("Invalid built path", { pathWithParams });
      return;
    }
    navigate(pathWithParams, rest)
  };
}