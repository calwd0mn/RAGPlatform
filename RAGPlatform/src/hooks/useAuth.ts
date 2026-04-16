import { useQueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { queryKeys } from "../constants/queryKeys";
import { getCurrentUser, login as loginService, register as registerService } from "../services/auth";
import { onUnauthorized } from "../services/http";
import type { AuthResponse, AuthUser, LoginPayload, RegisterRequest } from "../types/auth";
import {
  clearAccessToken,
  clearSavedUsername,
  getAccessToken,
  setAccessToken,
  setSavedUsername,
} from "../utils/token";

interface AuthContextValue {
  authStatus: "idle" | "loading" | "authenticated" | "unauthenticated";
  currentUser: AuthUser | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAndStoreCurrentUser(): Promise<AuthUser> {
  const profile = await getCurrentUser();
  setSavedUsername(profile.username);
  return profile;
}

function applyAuthSuccess(response: AuthResponse): void {
  setAccessToken(response.accessToken);
  setSavedUsername(response.user.username);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [authStatus, setAuthStatus] = useState<
    "idle" | "loading" | "authenticated" | "unauthenticated"
  >("idle");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const clearAuthState = useCallback(() => {
    clearAccessToken();
    clearSavedUsername();
    setCurrentUser(null);
    setAuthStatus("unauthenticated");
    queryClient.clear();
  }, [queryClient]);

  const hydrateFromToken = useCallback(async () => {
    if (!getAccessToken()) {
      setCurrentUser(null);
      setAuthStatus("unauthenticated");
      return;
    }

    setAuthStatus("loading");
    try {
      const user = await queryClient.fetchQuery({
        queryKey: queryKeys.auth.profile,
        queryFn: fetchAndStoreCurrentUser,
      });
      setCurrentUser(user);
      setAuthStatus("authenticated");
    } catch {
      clearAuthState();
    }
  }, [clearAuthState, queryClient]);

  useEffect(() => {
    void hydrateFromToken();
  }, [hydrateFromToken]);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      clearAuthState();
    });
    return unsubscribe;
  }, [clearAuthState]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setAuthStatus("loading");
      try {
        const authResponse = await loginService(payload);
        applyAuthSuccess(authResponse);
        const user = await queryClient.fetchQuery({
          queryKey: queryKeys.auth.profile,
          queryFn: fetchAndStoreCurrentUser,
        });
        setCurrentUser(user);
        setAuthStatus("authenticated");
      } catch (error) {
        clearAuthState();
        throw error;
      }
    },
    [clearAuthState, queryClient],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      setAuthStatus("loading");
      try {
        const authResponse = await registerService(payload);
        applyAuthSuccess(authResponse);
        const user = await queryClient.fetchQuery({
          queryKey: queryKeys.auth.profile,
          queryFn: fetchAndStoreCurrentUser,
        });
        setCurrentUser(user);
        setAuthStatus("authenticated");
      } catch (error) {
        clearAuthState();
        throw error;
      }
    },
    [clearAuthState, queryClient],
  );

  const logout = useCallback(() => {
    clearAuthState();
  }, [clearAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authStatus,
      currentUser,
      login,
      register,
      logout,
    }),
    [authStatus, currentUser, login, register, logout],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
