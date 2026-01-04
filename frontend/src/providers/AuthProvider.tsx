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

  /* --------------------------------
     Bootstrap session on app load
  -------------------------------- */
  useEffect(() => {
    async function bootstrap() {
      try {
        const expiresRaw =
          localStorage.getItem("expires_at") ||
          sessionStorage.getItem("expires_at");

        const expiresAt = Number(expiresRaw);

        if (!expiresAt || isNaN(expiresAt)) {
          throw new Error("Invalid session");
        }

        const profile = await getProfile();
        setUser(profile);

        scheduleSession(Number(expiresAt) * 1000);
        console.log("expiresAt from storage: ", expiresAt);
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
    return clearTimers;
  }, []);

  /* --------------------------------
     Session timing logic
  -------------------------------- */
  const clearTimers = () => {
    console.log("Clearing timers...");

    if (expiryTimeout.current) {
      console.log("⏰ Expiry timer cleared");
      clearTimeout(expiryTimeout.current);
      expiryTimeout.current = null;
    }

    if (warningTimeout.current) {
      console.log("🔔 Warning timer cleared");
      clearTimeout(warningTimeout.current);
      warningTimeout.current = null;
    }

    console.log("User logged out or session reset.");
  };

  const scheduleSession = (expiresAt: number) => {
    clearTimers();

    const now = Date.now();
    const timeLeft = expiresAt - now;

    console.log("Current time (ms):", now);
    console.log("Token expires at (ms):", expiresAt);
    console.log("Time left (ms):", timeLeft);

    if (timeLeft <= 0) {
      console.log("Token already expired. Logging out...");
      logout();
      // The above logs will persist even after logout
      return;
    }

    const warningTime = Math.max(timeLeft - 10 * 1000, 0);
    console.log("Warning will fire in (ms):", warningTime);

    warningTimeout.current = window.setTimeout(() => {
      console.log("🔥 Dispatching session-warning event");
      window.dispatchEvent(new Event("session-warning"));
    }, warningTime);

    expiryTimeout.current = window.setTimeout(() => {
      console.log("⛔ Token expired. Logging out...");
      logout();
    }, timeLeft);
  };

  /* --------------------------------
     Auth actions
  -------------------------------- */
  const login = async (
    email: string,
    password: string,
    rememberMe: boolean
  ) => {
    const data = await loginRequest({ email, password });

    const storage = rememberMe ? localStorage : sessionStorage;
    localStorage.clear();
    sessionStorage.clear();

    storage.setItem("access_token", data.access_token);
    storage.setItem("refresh_token", data.refresh_token);
    storage.setItem("expires_at", String(data.access_exp));
    storage.setItem("user", JSON.stringify(data.user));

    setUser(data.user);
    scheduleSession(data.access_exp * 1000);
  };

  const extendSession = async () => {
    try {
      const data = await refreshToken();

      const storage = localStorage.getItem("refresh_token")
        ? localStorage
        : sessionStorage;

      storage.setItem("access_token", data.access_token);
      storage.setItem("expires_at", String(data.expires_at));

      scheduleSession(data.expires_at * 1000);
    } catch {
      logout();
    }
    window.dispatchEvent(new Event("session-extended"));
  };

  const register = async (
    fullName: string,
    email: string,
    password: string
  ) => {
    return registerRequest({
      full_name: fullName,
      email,
      password,
    });
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch (err) {
      // ignore 
      console.warn("Logout request failed (likely token expired)")
    }
    clearAuth();
  };

  /* --------------------------------
     Helpers
  -------------------------------- */
  const clearAuth = () => {
    clearTimers();
    localStorage.clear();
    sessionStorage.clear();
    setUser(null);
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
