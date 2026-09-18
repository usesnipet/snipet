import { useMutation } from "@tanstack/react-query";

import { useNavigate } from "@/hooks/use-navigate";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { ROUTES } from "@/routes";

import { authService } from "./service";
import { useAuthStore } from "./store";

import type { AuthResponse, ChangePassword, Login } from "./schemas";
import type { ServicePostOptions, ServicePutOptions } from "@/lib/services";
import type { User } from "@/models/user";
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
        accessToken: result.access_token,
        accessTokenExpiresAt: result.expires_at.toISOString(),
        refreshToken: result.refresh_token,
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
        await authService.logout({ refresh_token: refreshToken }).catch(() => {});
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
  opts?: ServicePutOptions<ChangePassword, void>,
): UseMutationResult<void, Error, ChangePassword> => {
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
