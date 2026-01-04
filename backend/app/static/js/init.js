const apiUrl = window.API_URL || "http://localhost:5000";

// Always include credentials (cookies) for secure routes
async function secureFetch(url, options = {}) {
  const config = {
    ...options,
    credentials: "include", // ✅ This is essential
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };

  return fetch(url, config);
}
