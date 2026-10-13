import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthState = {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
};

// The only client-side state the app needs: the JWT. Everything that comes
// from the server (user, portfolio, stocks) lives in TanStack Query instead.
// persist() keeps the token in localStorage, so a page refresh stays logged in.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    { name: 'paper-trading-auth' },
  ),
);
