import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  getProfile,
  refreshToken,
} from "../services/auth.service";
import { AuthContext, type User } from "../context/AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const expiryTimeout = useRef<number | null>(null);
  const warningTimeout = useRef<number | null>(null);

  /* -------------------------
     Clear timers helper
  ------------------------- */
  const clearTimers = () => {
    if (expiryTimeout.current) {
      clearTimeout(expiryTimeout.current);
      expiryTimeout.current = null;
    }
    if (warningTimeout.current) {
      clearTimeout(warningTimeout.current);
      warningTimeout.current = null;
    }
  };

  /* -------------------------
     Bootstrap session
  ------------------------- */
  useEffect(() => {
    async function bootstrap() {
      try {
        const expiresRaw =
          localStorage.getItem("expires_at") ||
          sessionStorage.getItem("expires_at");

        if (!expiresRaw) throw new Error("No session found");

        const expiresAtSec = Number(expiresRaw);
        if (isNaN(expiresAtSec)) throw new Error("Invalid expiry timestamp");

        scheduleSession(expiresAtSec * 1000);

        try {
          const profile = await getProfile();
          setUser(profile);
        } catch {
          // try refreshing token if profile fetch fails
          await extendSession();
          const profile = await getProfile();
          setUser(profile);
        }
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
    return clearTimers;
  }, []);

  /* -------------------------
     Schedule session warning & expiry
  ------------------------- */
  const scheduleSession = (expiresAtMs: number) => {
    clearTimers();

    const now = Date.now();
    const timeLeft = expiresAtMs - now;

    if (timeLeft <= 0) {
      // Token already expired
      logout(); // auto-logout
      return;
    }

    // Warning 10 seconds before expiry
    const warningTime = Math.max(timeLeft - 10 * 1000, 0);
    warningTimeout.current = window.setTimeout(() => {
      window.dispatchEvent(new Event("session-warning"));
    }, warningTime);

    // Expiry handler
    expiryTimeout.current = window.setTimeout(() => {
      // If user did not click "Extend", log them out
      logout();
    }, timeLeft);
  };

  /* -------------------------
     Auth actions
  ------------------------- */
  const login = async (
    email: string,
    password: string,
    rememberMe: boolean
  ) => {
    const data = await loginRequest({ email, password });
    const storage = rememberMe ? localStorage : sessionStorage;

    // Clear old tokens
    ["access_token", "refresh_token", "expires_at", "user"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    storage.setItem("access_token", data.access_token);
    storage.setItem("refresh_token", data.refresh_token);
    storage.setItem("expires_at", String(data.access_exp));
    storage.setItem("user", JSON.stringify(data.user));

    setUser(data.user);
    scheduleSession(data.access_exp * 1000);
  };

  const extendSession = async (): Promise<void> => {
    try {
      const data = await refreshToken();
      const storage = localStorage.getItem("refresh_token")
        ? localStorage
        : sessionStorage;

      storage.setItem("access_token", data.access_token);
      storage.setItem("expires_at", String(data.expires_at));

      scheduleSession(data.expires_at * 1000);
      window.dispatchEvent(new Event("session-extended"));
    } catch {
      clearAuth();
    }
  };

  const register = async (fullName: string, email: string, password: string) =>
    registerRequest({ full_name: fullName, email, password });

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Ignore errors from expired token
    }
    clearAuth();
  };

  // clear auth
  const clearAuth = () => {
    clearTimers();
    ["access_token", "refresh_token", "expires_at", "user"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    setUser(null);
    window.dispatchEvent(new Event("session-extended")); // hide countdown if open
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        extendSession,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}
