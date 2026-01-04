import { apiUrl, secureFetch, getCookie } from './utils.js';

console.log("📆 sessions.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  fetchCoursesForSessionDropdown();
  fetchMySessions();

  const createForm = document.getElementById("createSessionForm");
  if (createForm) {
    createForm.addEventListener("submit", handleCreateSession);
  }
});

// === FETCH COURSES FOR SELECT ===
async function fetchCoursesForSessionDropdown() {
  try {
    const res = await secureFetch(`${apiUrl}/api/courses/all`);
    const data = await res.json();

    const select = document.getElementById("sessionCourseSelect");
    if (!select) return;

    select.innerHTML = `<option value="">Select Course</option>`;
    data.courses.forEach(course => {
      const opt = document.createElement("option");
      opt.value = course.id;
      opt.textContent = `${course.course_code} - ${course.course_name}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load course dropdown:", err);
    showToast("error", "Could not load course list.");
  }
}

// === FETCH SESSIONS ===
async function fetchMySessions() {
  try {
    const res = await secureFetch(`${apiUrl}/api/session/my-sessions`);
    const data = await res.json();
    const sessions = data.sessions || [];

    const container = document.getElementById("sessionsList");
    if (!container) return;

    if (!sessions.length) {
      container.innerHTML = "<p>No sessions found.</p>";
      return;
    }

    container.innerHTML = "";
    sessions.forEach(sess => {
      const div = document.createElement("div");
      div.className = "session-card";
      div.innerHTML = `
        <strong>Code:</strong> ${sess.code}<br/>
        <strong>Course:</strong> ${sess.course_id}<br/>
        <strong>Expires:</strong> ${new Date(sess.expires_at).toLocaleString()}<br/>
        <strong>Location:</strong> (${sess.latitude.toFixed(4)}, ${sess.longitude.toFixed(4)})<br/>
        <button onclick="deleteSession(${sess.id})">Delete</button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Session fetch error:", err);
    showToast("error", "Could not load sessions.");
  }
}

// === CREATE SESSION ===
async function handleCreateSession(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = {
    course_id: form.get("course_id"),
    latitude: parseFloat(form.get("latitude")),
    longitude: parseFloat(form.get("longitude")),
    radius: parseFloat(form.get("radius")),
    duration: parseInt(form.get("duration")),
  };

  try {
    const res = await secureFetch(`${apiUrl}/api/session/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showToast("success", "Session created.");
      e.target.reset();
      fetchMySessions();
    } else {
      showToast("error", "Failed to create session.");
    }
  } catch (err) {
    console.error("Session creation error:", err);
    showToast("error", "Something went wrong.");
  }
}

// === DELETE SESSION ===
async function deleteSession(id) {
  if (!confirm("Delete this session?")) return;
  try {
    const res = await secureFetch(`${apiUrl}/api/session/delete/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      showToast("success", "Session deleted.");
      fetchMySessions();
    } else {
      showToast("error", "Delete failed.");
    }
  } catch (err) {
    console.error("Delete session error:", err);
    showToast("error", "Could not delete session.");
  }
}

// Expose deleteSession globally for inline onclick
window.deleteSession = deleteSession;