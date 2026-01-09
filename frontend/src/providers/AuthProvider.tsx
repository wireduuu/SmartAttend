import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  getProfile,
  refreshToken,
} from "../services/auth.service";
import { AuthContext, type User } from "../context/AuthContext";
import {
  SESSION_WARNING_SECONDS,
  IDLE_TIMEOUT_SECONDS,
  IDLE_WARNING_SECONDS,
} from "../types/session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const expiryTimeout = useRef<number | null>(null);
  const warningTimeout = useRef<number | null>(null);
  const idleTimeout = useRef<number | null>(null);
  const idleWarningTimeout = useRef<number | null>(null);

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
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current);
      idleTimeout.current = null;
    }
    if (idleWarningTimeout.current) {
      clearTimeout(idleWarningTimeout.current);
      idleWarningTimeout.current = null;
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
     Listen for cross-tab events
  ------------------------- */
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "logout_marker") {
        // Another tab logged out
        clearAuth();
      }

      if (
        event.storageArea === localStorage &&
        event.key === "expires_at" &&
        event.newValue
      ) {
        // Session extended in another tab
        rescheduleFromStorage(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!user) return;

    const resetIdle = () => {
      scheduleIdleTimers();
    };

    const events = ["mousemove", "keydown", "click", "touchstart"];

    events.forEach((event) => window.addEventListener(event, resetIdle));

    // Start idle timers immediately on login
    scheduleIdleTimers();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdle));
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      if (idleWarningTimeout.current) clearTimeout(idleWarningTimeout.current);
    };
  }, [user]);

  /* -------------------------
     Schedule session warning & expiry
  ------------------------- */
  const scheduleSession = (expiresAtMs: number) => {
    clearTimers();

    const now = Date.now();
    const timeLeft = expiresAtMs - now;

    if (timeLeft <= 0) {
      // Token already expired
      clearAuth();
      return;
    }

    // Warning before expiry (SESSION_WARNING_SECONDS)
    const warningTime = Math.max(timeLeft - SESSION_WARNING_SECONDS * 1000, 0);

    warningTimeout.current = window.setTimeout(() => {
      window.dispatchEvent(new Event("session-warning"));
    }, warningTime);

    // Expiry handler
    expiryTimeout.current = window.setTimeout(() => {
      logout();
    }, timeLeft);
  };

  const scheduleIdleTimers = () => {
    // Clear previous idle timers
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
    if (idleWarningTimeout.current) clearTimeout(idleWarningTimeout.current);

    // Warning before idle logout
    idleWarningTimeout.current = window.setTimeout(() => {
      window.dispatchEvent(new Event("idle-warning"));
    }, IDLE_WARNING_SECONDS * 1000);

    // Idle logout
    idleTimeout.current = window.setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT_SECONDS * 1000);
  };

  // Reschedule session
  const rescheduleFromStorage = (expiresRaw: string | null) => {
    if (!expiresRaw) {
      clearAuth();
      return;
    }

    const expiresAtSec = Number(expiresRaw);
    if (isNaN(expiresAtSec)) {
      clearAuth();
      return;
    }

    scheduleSession(expiresAtSec * 1000);
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
    scheduleIdleTimers();
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
      scheduleIdleTimers();
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
      // Ignore errors
    }

    // Mark logout in localStorage for other tabs
    localStorage.setItem("logout_marker", Date.now().toString());
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
    window.dispatchEvent(new Event("session-extended")); // hide countdown
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
