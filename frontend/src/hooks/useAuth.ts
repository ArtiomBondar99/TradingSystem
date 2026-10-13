import { useMutation, useQuery } from '@tanstack/react-query';
import { getMe, login, register } from '../services/auth.service';
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
