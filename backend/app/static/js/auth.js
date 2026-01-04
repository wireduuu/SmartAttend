// static/js/auth.js
import { apiUrl, showToast } from './utils.js';

console.log("🔐 auth.js loaded");

// --- State ---
let accessExpiryTime = Number(localStorage.getItem("access_expiry")) || 0; // ms
let refreshExpiryTime = Number(localStorage.getItem("refresh_expiry")) || 0; // ms

let countdownInterval = null;
let monitorInterval = null;
let autoRefreshTimeout = null;
let forceLogoutTimeout = null;

const REFRESH_BEFORE_MS = 60 * 1000; // attempt refresh 60s before expiry

// ---------------------- Secure fetch ----------------------
export async function secureFetch(input, init = {}) {
  const doFetch = () => fetch(input, { ...init, credentials: "include" });

  let response = await doFetch();

  if (response.status === 401) {
    console.warn("⚠️ secureFetch: 401 received — attempting silent refresh...");
    const refreshed = await attemptRefreshSilently();
    if (refreshed) {
      console.log("🔁 secureFetch: refresh succeeded — retrying original request");
      response = await doFetch();
    } else {
      console.error("⛔ secureFetch: silent refresh failed — redirecting to login");
      redirectToLogin();
    }
  }

  return response;
}

// ---------------------- Silent refresh ----------------------
export async function attemptRefreshSilently() {
  try {
    const res = await fetch(`${apiUrl}/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      console.warn("attemptRefreshSilently: /refresh returned", res.status);
      return false;
    }

    const data = await res.json().catch(() => ({}));
    if (data && data.access_exp) {
      updateSessionExpiry(data);
    } else {
      const ok = await fetchTokenExpiry();
      if (!ok) return false;
    }
    return true;
  } catch (err) {
    console.error("attemptRefreshSilently error:", err);
    return false;
  }
}

// ---------------------- Fetch token expiry ----------------------
export async function fetchTokenExpiry() {
  try {
    const res = await fetch("/token-expiry", {
      method: "GET",
      credentials: "include",
    });

    if (res.status === 401) {
      console.warn("fetchTokenExpiry: 401 → trying silent refresh");
      const ok = await attemptRefreshSilently();
      if (!ok) return false;
      return await fetchTokenExpiry();
    }

    if (!res.ok) {
      console.warn("fetchTokenExpiry: non-ok response", res.status);
      return false;
    }

    const data = await res.json();
    updateSessionExpiry({ access_exp: data.access_exp, refresh_exp: data.refresh_exp });
    return true;
  } catch (err) {
    console.error("fetchTokenExpiry error:", err);
    return false;
  }
}

// ---------------------- Update expiries + timers ----------------------
export function updateSessionExpiry({ access_exp, refresh_exp }) {
  const accessMs = Number(access_exp) > 1e12 ? Number(access_exp) : Number(access_exp) * 1000;
  const refreshMs = refresh_exp
    ? (Number(refresh_exp) > 1e12 ? Number(refresh_exp) : Number(refresh_exp) * 1000)
    : 0;

  if (!accessMs || Number.isNaN(accessMs)) {
    console.warn("updateSessionExpiry: invalid access_exp received", access_exp);
    return;
  }

  // Only update if the new expiry is significantly later than current expiry
  if (accessMs > accessExpiryTime + 5000) {  // 5 seconds tolerance
    clearAllTimers();

    accessExpiryTime = accessMs;
    refreshExpiryTime = refreshMs;

    localStorage.setItem("access_expiry", accessExpiryTime);
    localStorage.setItem("refresh_expiry", refreshExpiryTime);

    console.log("🔄 updateSessionExpiry:", {
      accessExpiryISO: new Date(accessExpiryTime).toISOString(),
      deltaMs: accessExpiryTime - Date.now()
    });

    startSessionCountdown();
    monitorSession();
    scheduleAutoRefresh();
    scheduleForceLogout();
  } else {
    console.log("updateSessionExpiry: Ignoring expiry update; not later than current");
  }
}

// ---------------------- Countdown label ----------------------
export function startSessionCountdown() {
  const label = document.getElementById("tokenCountdownLabel");
  clearInterval(countdownInterval);

  function tick() {
    const remaining = accessExpiryTime - Date.now();
    if (remaining <= 0) {
      if (label) {
        label.textContent = "🔒 Session expired.";
        label.style.color = "red";
      }
      clearInterval(countdownInterval);
      console.log("startSessionCountdown: expired -> redirect");
      redirectToLogin();
      return;
    }
    if (label) {
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      label.textContent = `⏳ Session ends in ${mins}m ${secs}s`;
      label.style.color = remaining <= 3 * 60 * 1000 ? "red" : "orange";
      label.style.fontWeight = remaining <= 3 * 60 * 1000 ? "bold" : "normal";
    }
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ---------------------- Warning box ----------------------
export function monitorSession() {
  const warnBox = document.getElementById("tokenWarning");
  const warningText = document.getElementById("tokenWarningText");

  clearInterval(monitorInterval);
  if (!warnBox || !warningText) return;

  monitorInterval = setInterval(() => {
    const remaining = accessExpiryTime - Date.now();

    if (remaining <= 0) {
      warningText.textContent = "🔒 Session expired. Redirecting...";
      warnBox.classList.add("show");
      clearInterval(monitorInterval);
      redirectToLogin();
      return;
    }

    if (remaining <= 3 * 60 * 1000) {
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      warningText.textContent = `⏰ Session will expire in ${mins}m ${secs}s.`;
      warnBox.classList.add("show");
    } else {
      warnBox.classList.remove("show");
    }
  }, 1000);
}

// ---------------------- Auto-refresh ----------------------
export function scheduleAutoRefresh() {
  clearAutoRefresh();
  const msUntilRefresh = accessExpiryTime - Date.now() - REFRESH_BEFORE_MS;

  const delay = msUntilRefresh <= 0 ? 1000 : msUntilRefresh;
  autoRefreshTimeout = setTimeout(async () => {
    console.log("scheduleAutoRefresh: attempting silent refresh (scheduled)");
    const ok = await attemptRefreshSilently();
    if (!ok) console.warn("scheduleAutoRefresh: refresh failed");
  }, delay);
}

export function clearAutoRefresh() {
  if (autoRefreshTimeout) clearTimeout(autoRefreshTimeout);
  autoRefreshTimeout = null;
}

// ---------------------- Force logout ----------------------
function scheduleForceLogout() {
  if (forceLogoutTimeout) clearTimeout(forceLogoutTimeout);

  const msUntilExpiry = accessExpiryTime - Date.now();

  if (msUntilExpiry <= 0) {
    redirectToLogin();
    return;
  }

  forceLogoutTimeout = setTimeout(() => {
    console.warn("💥 Token expired (forceLogout) — forcing logout");
    redirectToLogin();
  }, msUntilExpiry + 500);
}

// ---------------------- Manual extension ----------------------
export function setupManualSessionExtension() {
  const btn = document.getElementById("extendSessionBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Refreshing...";
    const ok = await attemptRefreshSilently();
    if (ok) {
      document.getElementById("tokenWarning")?.classList.remove("show");
      showToast("success", "✅ Session extended!");
    } else {
      showToast("error", "⚠️ Session extension failed.");
      redirectToLogin();
    }
    btn.disabled = false;
    btn.textContent = "Stay Signed In";
  });
}

// ---------------------- Logout helpers ----------------------
export function logout() {
  fetch(`${apiUrl}/logout`, { method: "POST", credentials: "include" }).finally(() => {
    clearAllTimers();
    window.location.href = "/login";
  });
}

export function redirectToLogin() {
  try {
    fetch(`${apiUrl}/logout`, { method: "POST", credentials: "include" }).finally(() => {
      clearAllTimers();
      window.location.href = "/login";
    });
  } catch {
    clearAllTimers();
    window.location.href = "/login";
  }
}

function clearAllTimers() {
  if (countdownInterval) clearInterval(countdownInterval);
  if (monitorInterval) clearInterval(monitorInterval);
  clearAutoRefresh();
  if (forceLogoutTimeout) clearTimeout(forceLogoutTimeout);
  countdownInterval = monitorInterval = autoRefreshTimeout = forceLogoutTimeout = null;
}

// ---------------------- Initialization ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  if (accessExpiryTime > Date.now()) {
    // Resume existing timers from persisted values
    startSessionCountdown();
    monitorSession();
    scheduleAutoRefresh();
    scheduleForceLogout();
  }

  // Fetch latest expiry once at startup
  const ok = await fetchTokenExpiry();
  if (ok) {
    console.debug("auth init: token expiry synced and timers started");
  } else {
    console.debug("auth init: could not sync expiry");
  }

  setupManualSessionExtension();
});
