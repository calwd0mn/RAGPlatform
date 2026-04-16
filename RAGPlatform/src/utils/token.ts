import { TOKEN_STORAGE_KEY, USERNAME_STORAGE_KEY } from "../constants/storage";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getSavedUsername(): string {
  return localStorage.getItem(USERNAME_STORAGE_KEY) ?? "未命名用户";
}

export function setSavedUsername(username: string): void {
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

export function clearSavedUsername(): void {
  localStorage.removeItem(USERNAME_STORAGE_KEY);
}
