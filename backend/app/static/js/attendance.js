import { apiUrl, secureFetch, getCookie } from './utils.js';

console.log("📊 attendance.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  fetchCoursesForDropdown();

  document.getElementById("filterByCourse")?.addEventListener("change", e => {
    const courseId = e.target.value;
    if (courseId) fetchSessionsForCourse(courseId);
  });

  document.getElementById("fetchAttendanceBtn")?.addEventListener("click", fetchAttendance);
  document.getElementById("exportAttendanceBtn")?.addEventListener("click", exportAttendance);
});

// === DROPDOWN SETUP ===
async function fetchCoursesForDropdown() {
  try {
    const res = await secureFetch(`${apiUrl}/api/courses/all`);
    const data = await res.json();

    const courseSelect = document.getElementById("filterByCourse");
    if (!courseSelect) return;

    courseSelect.innerHTML = '<option value="">Filter by Course</option>';
    data.courses.forEach(course => {
      const option = document.createElement('option');
      option.value = course.id;
      option.textContent = `${course.course_name} (${course.course_code})`;
      courseSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Dropdown fetch error:", err);
    showToast("error", "Could not load courses.");
  }
}

async function fetchSessionsForCourse(courseId) {
  try {
    const res = await secureFetch(`${apiUrl}/api/session/by-course/${courseId}`);
    const { sessions = [] } = await res.json();

    const sessionSelect = document.getElementById("filterBySession");
    if (!sessionSelect) return;

    sessionSelect.innerHTML = '<option value="">All Sessions</option>';
    sessions.forEach(({ id }) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `Session #${id}`;
      sessionSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Session dropdown error:", err);
    showToast("error", "Failed to load sessions.");
  }
}

// === FETCH ATTENDANCE ===
async function fetchAttendance() {
  const courseId = document.getElementById('filterByCourse')?.value;
  const sessionId = document.getElementById('filterBySession')?.value;
  const indexNum = document.getElementById('filterByIndex')?.value.trim();

  let url = "";
  if (indexNum) url = `${apiUrl}/api/attendance/student/${indexNum}`;
  else if (sessionId) url = `${apiUrl}/api/attendance/by-session/${sessionId}`;
  else if (courseId) url = `${apiUrl}/api/attendance/course/${courseId}`;
  else {
    showToast("info", "Please select a course or enter an index number.");
    return;
  }

  try {
    const res = await secureFetch(url);
    if (!res.ok) throw new Error("Fetch failed");

    const { attendance = [] } = await res.json();
    const tbody = document.querySelector('#attendanceTable tbody');
    if (!tbody) return;

    tbody.innerHTML = attendance.map(record => `
      <tr>
        <td>${record.student_id || 'N/A'}</td>
        <td>${record.session_id || '—'}</td>
        <td>${record.status}</td>
        <td>${new Date(record.timestamp).toLocaleString()}</td>
      </tr>
    `).join('');

    showToast("success", `Loaded ${attendance.length} record(s).`);
  } catch (err) {
    console.error("Attendance fetch error:", err);
    showToast("error", "Failed to fetch attendance.");
  }
}

// === EXPORT ATTENDANCE ===
function exportAttendance() {
  const rows = [...document.querySelectorAll('#attendanceTable tr')];
  const csv = rows.map(row =>
    [...row.cells].map(cell => `"${cell.textContent}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'attendance.csv';
  link.click();

  showToast("success", "Attendance exported.");
}
