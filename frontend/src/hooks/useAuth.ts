import { useMutation, useQuery } from '@tanstack/react-query';
import {
  forgotPassword,
  getMe,
  login,
  register,
  resetPassword,
} from '../services/auth.service';
import type { RegisterRequest } from '../services/types';
import { useAuthStore } from './useAuthStore';

// The logged-in user's profile. Only fetched while there is a token.
export function useCurrentUser() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: token !== null,
  });
}

// Saving the token is all it takes: GuestRoute sees it and redirects
// into the app, so the pages don't navigate by themselves.
export function useLogin() {
  const setToken = useAuthStore((state) => state.setToken);

  return useMutation({
    mutationFn: login,
    onSuccess: (response) => setToken(response.accessToken),
  });
}

export function useForgotPassword() {
  // A wrapper, not mutationFn: forgotPassword. TanStack passes a second
  // argument (its context) that the API function shouldn't receive.
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
  });
}

export function useResetPassword() {
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      resetPassword(token, password),
    // If this browser was logged in, that session belonged to the old
    // password: end it, so the next login uses the new one
    onSuccess: () => logout(),
  });
}

export function useRegister() {
  const setToken = useAuthStore((state) => state.setToken);

  return useMutation({
    mutationFn: async (body: RegisterRequest) => {
      await register(body);
      // /auth/register returns no token: log in with the same credentials
      return login({ email: body.email, password: body.password });
    },
    onSuccess: (response) => setToken(response.accessToken),
  });
}
