import { useMutation } from "@tanstack/react-query";

import { useNavigate } from "@/hooks/use-navigate";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { ROUTES } from "@/routes";

import { authService } from "@snipet/client";
import { useAuthStore } from "./store";

import type { AuthResponse, ChangeOwnPassword, Login, User } from "@snipet/shared";
import type { ServicePostOptions, ServicePutOptions } from "@snipet/client";
import type { RoutePath } from "@/routes";
import type { UseMutationResult } from "@tanstack/react-query";

export const useLogin = (
  opts?: ServicePostOptions<Login, AuthResponse>,
): UseMutationResult<AuthResponse, Error, Login> => {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data) => authService.login(data, opts),
    onSuccess: (result) => {
      setSession({
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.expiresAt.toISOString(),
        refreshToken: result.refreshToken,
        user: result.user,
      });
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      navigate((redirect || ROUTES.home) as RoutePath, { replace: true });
    },
    onError: () => {
      toast({ title: "Invalid username or password", variant: "destructive" });
    },
  });
};

export const useLogout = (): UseMutationResult<void, Error, void> => {
  const navigate = useNavigate();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSession = useAuthStore((s) => s.clearSession);

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await authService.logout({ refreshToken }).catch(() => {});
      }
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
      navigate(ROUTES.login, { replace: true });
    },
  });
};

export const useChangePassword = (
  opts?: ServicePutOptions<ChangeOwnPassword, void>,
): UseMutationResult<void, Error, ChangeOwnPassword> => {
  const clearSession = useAuthStore((s) => s.clearSession);

  return useMutation({
    mutationFn: (data) => authService.changePassword(data, opts),
    onSuccess: () => {
      toast({ title: "Password changed. Please sign in again." });
      clearSession();
    },
    onError: () => {
      toast({ title: "Failed to change password", variant: "destructive" });
    },
  });
};

export const useCurrentUser = (): User | null => useAuthStore((s) => s.user);

export const useIsAuthenticated = (): boolean =>
  useAuthStore((s) => !!s.accessToken);
