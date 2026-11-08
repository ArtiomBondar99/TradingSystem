import { api } from './api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
} from './types';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', credentials);
  return data;
}

// Creates the account (and its $100,000 wallet). Returns the user, no token.
export async function register(body: RegisterRequest): Promise<User> {
  const { data } = await api.post<User>('/auth/register', body);
  return data;
}

// Always the same answer, registered email or not (the backend never says)
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

// token = the one from the emailed link. 400 if it's used or expired.
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/users/me');
  return data;
}
