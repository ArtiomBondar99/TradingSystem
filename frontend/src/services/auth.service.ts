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

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/users/me');
  return data;
}
