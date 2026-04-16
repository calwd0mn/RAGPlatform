import { http } from "./http";
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterRequest,
} from "../types/auth";

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await http.post<AuthResponse>("/auth/login", payload);
  return response.data;
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const response = await http.post<AuthResponse>("/auth/register", payload);
  return response.data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await http.get<AuthUser>("/auth/profile");
  return response.data;
}
