import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/models/user";

export type Session = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: User;
};

type AuthState = {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: null,
      user: null,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          accessTokenExpiresAt: session.accessTokenExpiresAt,
          refreshToken: session.refreshToken,
          user: session.user,
        }),
      clearSession: () =>
        set({
          accessToken: null,
          accessTokenExpiresAt: null,
          refreshToken: null,
          user: null,
        }),
    }),
    { name: "snipet-auth" },
  ),
);
