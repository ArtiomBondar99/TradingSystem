import axios from 'axios';
import { useAuthStore } from '../hooks/useAuthStore';
import type { ApiErrorBody } from './types';

// One Axios instance for the whole app. "/api" goes through the Vite proxy
// to the backend (see vite.config.ts).
export const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request. getState() reads the store outside React.
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 while logged in means the token expired (15 min) or is invalid:
// log out, and the protected routes redirect to /login. A 401 from the login
// form itself (wrong password) happens with no token, so it's left alone.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      useAuthStore.getState().token
    ) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

// Turns any error into a message we can show the user
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'Cannot reach the server. Is the backend running?';
    }

    if (error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'] as
        string | undefined;
      return `Too many attempts. Try again in ${retryAfter ?? 'a few'} seconds.`;
    }

    const body = error.response.data;
    if (body?.errors?.length) {
      return body.errors.join('. ');
    }
    if (body?.message) {
      return body.message;
    }
  }

  return 'Something went wrong. Please try again.';
}
