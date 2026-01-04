import { logout } from './auth.js';

export const apiUrl = window.API_URL || "http://127.0.0.1:5000";

let lastAccessTime = Date.now();

export function updateLastAccessTime() {
  lastAccessTime = Date.now();
}

export function getLastAccessTime() {
  return lastAccessTime;
}

export async function secureFetch(input, init = {}) {
  const doFetch = async () => {
    return await fetch(input, {
      ...init,
      credentials: "include"
    });
  };

  let response = await doFetch();

  if (response.status === 401) {
    console.warn("⚠️ Access token expired. Trying refresh...");

    const refreshRes = await fetch(`${apiUrl}/refresh`, {
      method: "POST",
      credentials: "include"
    });

    if (refreshRes.ok) {
      updateLastAccessTime();
      console.log("🔁 Token refreshed. Retrying request...");
      response = await doFetch();
    } else {
      console.error("⛔ Refresh failed. Redirecting...");
      window.location.href = "/login.html";
      return new Response(null, { status: 401 });
    }
  }

  return response;
}

export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function showToast(type = "info", message = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.className = `toast show ${type}`;
  toast.textContent = message;
  setTimeout(() => (toast.className = "toast"), 3500);
}

export { logout };