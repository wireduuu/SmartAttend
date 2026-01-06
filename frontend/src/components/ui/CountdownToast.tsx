import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export default function CountdownToast() {
  const { extendSession, user } = useAuth();
  const [seconds, setSeconds] = useState(0);

  /* -------------------------
     Show countdown on session warning
  ------------------------- */
  useEffect(() => {
    if (!user) return;

    const computeCountdown = () => {
      const expiresRaw =
        localStorage.getItem("expires_at") ||
        sessionStorage.getItem("expires_at");

      if (!expiresRaw) return;

      const expiresAtMs = Number(expiresRaw) * 1000;
      const timeLeftSec = Math.floor((expiresAtMs - Date.now()) / 1000);

      // Only show countdown if we're inside the warning window
      if (timeLeftSec > 0 && timeLeftSec <= 10) {
        setSeconds(timeLeftSec);
      }
    };

    // 🔹 Run immediately on mount (page refresh fix)
    computeCountdown();

    // 🔹 Still listen for future warning events
    window.addEventListener("session-warning", computeCountdown);

    return () =>
      window.removeEventListener("session-warning", computeCountdown);
  }, [user]);

  /* -------------------------
     Hide countdown on session extend
  ------------------------- */
  useEffect(() => {
    const hideCountdown = () => setSeconds(0);
    window.addEventListener("session-extended", hideCountdown);
    return () => window.removeEventListener("session-extended", hideCountdown);
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
