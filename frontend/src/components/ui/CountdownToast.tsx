import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { SESSION_WARNING_SECONDS } from "../../types/session";

export default function CountdownToast() {
  const { extendSession, user } = useAuth();
  const [seconds, setSeconds] = useState(0);

  /* -------------------------
     Compute countdown from storage
  ------------------------- */
  const computeCountdown = () => {
    const expiresRaw =
      localStorage.getItem("expires_at") ||
      sessionStorage.getItem("expires_at");

    if (!expiresRaw) {
      setSeconds(0);
      return;
    }

    const expiresAtMs = Number(expiresRaw) * 1000;
    const now = Date.now();

    const warningStartMs = expiresAtMs - SESSION_WARNING_SECONDS * 1000;

    // Only show countdown inside warning window
    if (now < warningStartMs || now >= expiresAtMs) {
      setSeconds(0);
      return;
    }

    const remaining = Math.ceil((expiresAtMs - now) / 1000);
    setSeconds(remaining);
  };

  /* -------------------------
     Initialize on mount & listen for session-warning events
     Wrap initial setState in setTimeout to avoid sync warning
  ------------------------- */
  useEffect(() => {
    if (!user) return;

    const timeout = setTimeout(() => computeCountdown(), 0); // async
    window.addEventListener("session-warning", computeCountdown);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("session-warning", computeCountdown);
    };
  }, [user]);

  /* -------------------------
     Hide countdown on session extend & cross-tab sync
  ------------------------- */
  useEffect(() => {
    const hideCountdown = () => setSeconds(0);
    window.addEventListener("session-extended", hideCountdown);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "expires_at") {
        setTimeout(computeCountdown, 0);
      }
      if (event.key === "logout_marker") {
        setSeconds(0);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("session-extended", hideCountdown);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  /* -------------------------
     Countdown interval
  ------------------------- */
  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  if (seconds <= 0) return null;

  return (
    <div className="fixed top-20 right-4 card w-fit p-4 shadow-lg bg-white dark:bg-gray-800 flex items-center gap-4">
      <p className="text-sm">
        Session expires in{" "}
        <b>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </b>
      </p>
      <button
        onClick={() => {
          const storage = localStorage.getItem("refresh_token")
            ? localStorage
            : sessionStorage;
          if (storage.getItem("refresh_token")) extendSession();
        }}
        className="btn-primary"
      >
        Extend Session
      </button>
    </div>
  );
}
