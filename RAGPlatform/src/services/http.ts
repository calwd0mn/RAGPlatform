import axios, { AxiosError } from "axios";
import type { ApiErrorPayload } from "../types/api";
import { getAccessToken } from "../utils/token";

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

function emitUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => listener());
}

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const http = axios.create({
  baseURL: apiBaseURL,
  timeout: 15_000,
});

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    if (error.response?.status === 401) {
      emitUnauthorized();
    }
    return Promise.reject(error);
  },
);
