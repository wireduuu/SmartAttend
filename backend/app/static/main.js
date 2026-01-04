console.log("✅ main.js loaded");


  let allCourses = []; // store all courses for filtering
  let editingCourseId = null;
  // Fetch real course stats and render the donut chart
  let donutChartInstance = null;
  let chartDataCache = {};
  let lastAccessTime = Date.now(); // Track when last access token was issued

 const apiUrl = window.API_URL || "http://127.0.0.1:5000";

 
// === SECURE FETCH WITH AUTO REFRESH ===
async function secureFetch(input, init = {}) {
  const doFetch = async () => {
    return await fetch(input, {
      ...init,
      credentials: "include"  // Needed for cookie-based JWT auth
    });
  };

  let response = await doFetch();

  if (response.status === 401) {
    console.warn("⚠️ Access token expired. Attempting to refresh...");

    const refreshRes = await fetch(`${apiUrl}/refresh`, {
      method: "POST",
      credentials: "include"
    });

    if (refreshRes.ok) {
      lastAccessTime = Date.now(); // update lastAccessTime after refresh
      console.log("🔁 Token refreshed. Retrying original request...");
      response = await doFetch();
    } else {
      console.error("⛔ Token refresh failed. Redirecting to login...");
      window.location.href = "/login.html";
      return new Response(null, { status: 401 });
    }
  }

  return response;
}

// === AUTO REFRESH EVERY 9 MINUTES ===
setInterval(() => {
  secureFetch(`${apiUrl}/refresh`, { method: "POST" })
    .then(res => {
      if (res.ok) {
        console.log("🔄 Access token auto-refreshed");
      } else {
        console.warn("❌ Auto-refresh failed");
      }
    })
    .catch(err => {
      console.error("⛔ Auto-refresh error:", err);
    });
}, 9 * 60 * 1000);  // 9 minutes in milliseconds

document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM is ready");

  // Realistic token duration setup (e.g. 15 mins total, 10 mins before warn)
  const tokenLifespan = 30 * 60 * 1000;       // 15 minutes
  const warningThreshold = 12 * 60 * 1000;    // Warn after 12 minutes
  let lastAccessTime = Date.now();            // Tracks last activity or refresh

  // Monitor token age every 30s
  setInterval(() => {
    const tokenAge = Date.now() - lastAccessTime;
    const warnBox = document.getElementById("tokenWarning");
    const warningText = document.getElementById("tokenWarningText");

    if (!warnBox || !warningText) return;

    // Show warning before expiry
    if (tokenAge >= warningThreshold && tokenAge < tokenLifespan) {
      warnBox.classList.add("show");
      warningText.textContent = "⏰ Your session is about to expire. Please stay active.";
    }

    // Hide warning if still safe
    if (tokenAge < warningThreshold) {
      warnBox.classList.remove("show");
    }

    // Expire session
    if (tokenAge >= tokenLifespan) {
      warningText.textContent = "🔒 Session expired. Redirecting to login...";
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000); // 2s delay to read message
    }
  }, 30000); // check every 30s (can reduce if preferred)
  
  // Manual refresh on user click
  document.getElementById("extendSessionBtn")?.addEventListener("click", async () => {
    try {
      const res = await fetch("/refresh", {
        method: "POST",
        credentials: "include"
      });

      if (res.ok) {
        lastAccessTime = Date.now(); // ✅ Reset token age
        document.getElementById("tokenWarning").classList.remove("show");
        showToast("success", "Session extended!");
      } else {
        showToast("error", "Unable to extend session.");
        window.location.href = "/login.html";
      }
    } catch (err) {
      console.error(err);
      window.location.href = "/login.html";
    }
  });

  const dropdown = document.getElementById("statType");
  if (dropdown) {
    dropdown.addEventListener("change", function () {
      loadCourseStats(this.value);  // Pass selected value
    });

    // Load stats based on current selection on first load
    loadCourseStats(dropdown.value);
  }
  
  loadCourses(); // fetch and render + filter setup

  // Global helpers
  window.App = {
    editCourse,
    deleteCourse,
    closeEditCourseModal,
    logout
  };

  // === COOKIE ===
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  // === FETCH & RENDER COURSES ===
  async function fetchCourses() {
      const search = document.getElementById('searchInput')?.value || "";
      const department = document.getElementById("filterDepartment")?.value || "";
      const semester = document.getElementById("filterSemester")?.value || "";

      const url = `${apiUrl}/api/courses/all?search=${search}&department=${department}&semester=${semester}`;

      try {
        const res = await secureFetch(url);
        if (!res.ok) {
          showToast("error", "Unauthorized or failed to fetch courses.");
          return [];
        }

        const data = await res.json();
        return data.courses || [];  // <- make sure this returns array
      } catch (err) {
        console.error(err);
        showToast("error", "Error fetching courses.");
        return [];
      }
    }

  function renderCourses(courses) {
    const grid = document.getElementById('courseGrid');
    if (!grid) return;

    grid.innerHTML = courses?.length
      ? courses.map(course => `
        <div class="course-card">
          <h3 class="course-title" title="${course.course_name}">
            ${course.course_code} – ${course.course_name}
          </h3>
          <p><strong>Department:</strong> ${course.department || "—"}</p>
          <p><strong>Semester:</strong> ${course.semester || "—"}</p>
          <div class="course-actions">
            <button class="btn btn-update" onclick="App.editCourse('${course.id}', '${course.course_code}', '${course.course_name}', '${course.department}', '${course.semester}')">Edit</button>
            <button class="btn btn-delete" onclick="App.deleteCourse('${course.id}')">Delete</button>
          </div>
        </div>`).join('')
      : "<p>No courses found.</p>";
  }

  // Function to open the edit modal and populate fields
  function editCourse(id, code, name, dept, semester) {
    document.getElementById("editCourseId").value = id;
    document.getElementById("editCourseCode").value = code;
    document.getElementById("editCourseName").value = name;
    document.getElementById("editDepartment").value = dept;
    document.getElementById("editSemester").value = semester;

    document.getElementById("editCourseModal").style.display = "block";
    document.getElementById("modalOverlay").style.display = "block";
  }

  // Close modal
  function closeEditCourseModal() {
    document.getElementById("editCourseModal").style.display = "none";
    document.getElementById("modalOverlay").style.display = "none";
  }

  // delete course
  function deleteCourse(courseId) {
    if (!confirm("Are you sure you want to delete this course?")) return;

    secureFetch(`${apiUrl}/api/courses/${courseId}`, {
      method: "DELETE",
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getCookie('csrf_access_token')
      },
      credentials: "include"
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(({ status, body }) => {
      if (status === 200) {
        showToast("success", body.message || "Course deleted");
        loadCourses();
      } else {
        showToast("error", body.error || "Failed to delete");
      }
    })
    .catch(err => {
      console.error("Delete error:", err);
      showToast("error", "Error deleting course.");
    });
  }

  // Fetch courses and initialize filters
  async function loadCourses() {
    const courses = await fetchCourses();
    if (courses) {
      allCourses = courses;
      populateFilterOptions(courses);
      renderCourses(courses);
    }
  }

  // Filter function
  function applyCourseFilters() {
    const department = document.getElementById("filterDepartment").value.trim().toLowerCase();
    const semester = document.getElementById("filterSemester").value.trim().toLowerCase();

    const filtered = allCourses.filter(course => {
      const dept = course.department?.trim().toLowerCase() || "";
      const sem = course.semester?.trim().toLowerCase() || "";
      return (!department || dept === department) && (!semester || sem === semester);
    });

    renderCourses(filtered);
  }

  function resetCourseFilters() {
    document.getElementById("filterDepartment").value = "";
    document.getElementById("filterSemester").value = "";
    renderCourses(allCourses);
  }

  // Populate dropdowns
  function populateFilterOptions(courses) {
    const departments = [...new Set(courses.map(c => c.department))];
    const semesters = [...new Set(courses.map(c => c.semester))];

    const deptSelect = document.getElementById("filterDepartment");
    const semSelect = document.getElementById("filterSemester");

    departments.forEach(dept => {
      const option = document.createElement("option");
      option.value = dept;
      option.textContent = dept;
      deptSelect.appendChild(option);
    });

    semesters.forEach(sem => {
      const option = document.createElement("option");
      option.value = sem;
      option.textContent = sem;
      semSelect.appendChild(option);
    });
  }

  // === TOAST ===
  function showToast(type = "info", message = "") {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.className = `toast show ${type}`;
    toast.textContent = message;
    setTimeout(() => toast.className = "toast", 3500);
  }

  // Automatically apply filters on change
  document.getElementById("resetFiltersBtn")?.addEventListener("click", resetCourseFilters);
  document.getElementById("filterDepartment")?.addEventListener("change", applyCourseFilters);
  document.getElementById("filterSemester")?.addEventListener("change", applyCourseFilters);



  async function fetchCoursesForSessionDropdown() {
    const res = await fetch("/courses/list", { credentials: "include" });
    const data = await res.json();

    const select = document.getElementById("sessionCourseSelect");
    select.innerHTML = `<option value="">Select Course</option>`;
    data.courses.forEach(course => {
      const opt = document.createElement("option");
      opt.value = course.id;
      opt.textContent = `${course.course_code} - ${course.course_name}`;
      select.appendChild(opt);
    });
  }

  async function fetchMySessions() {
    const res = await fetch("/sessions/my-sessions", { credentials: "include" });
    const { sessions } = await res.json();

    const container = document.getElementById("sessionsList");
    container.innerHTML = "";

    if (!sessions.length) {
      container.innerHTML = "<p>No sessions found.</p>";
      return;
    }

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
  }

  document.getElementById("createSessionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    payload.latitude = parseFloat(payload.latitude);
    payload.longitude = parseFloat(payload.longitude);
    payload.radius = parseFloat(payload.radius);
    payload.duration = parseInt(payload.duration);

    const res = await fetch("/sessions/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast("success", "Session created");
      e.target.reset();
      fetchMySessions();
    } else {
      showToast("error", "Failed to create session");
    }
  });

  async function deleteSession(id) {
    if (!confirm("Delete this session?")) return;
    const res = await fetch(`/sessions/delete/${id}`, {
      method: "DELETE",
      credentials: "include"
    });
    if (res.ok) {
      showToast("success", "Session deleted");
      fetchMySessions();
    } else {
      showToast("error", "Delete failed");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    fetchCoursesForSessionDropdown();
    fetchMySessions();
  });




  // === EDIT COURSE FORM ===
  const editCourseForm = document.getElementById('editCourseForm');
    if (editCourseForm) {
      editCourseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById("editCourseId").value;
        const course_code = document.getElementById("editCourseCode").value;
        const course_name = document.getElementById("editCourseName").value;
        const department = document.getElementById("editDepartment").value;
        const semester = document.getElementById("editSemester").value;

        try {
          const response = await fetch(`/api/courses/${id}`, {
            method: "PUT",
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-TOKEN': getCookie('csrf_access_token')
            },
            credentials: "include",
            body: JSON.stringify({ course_code, course_name, department, semester }),
          });

          const result = await response.json();

          if (response.ok) {
            alert("Course updated successfully");
            closeEditCourseModal();
            loadCourses();
          } else {
            alert("Update failed: " + (result.error || response.statusText));
          }
        } catch (err) {
          console.error("Fetch error:", err);
          alert("Something went wrong while updating the course.");
        }
      });
    }

    loadCourses();

  // === FETCH DROPDOWNS ===
  async function fetchCoursesForDropdown() {
    try {
      const res = await fetch(`${apiUrl}/api/courses`, {
        credentials: "include"
      });

      const data = await res.json();

      const courseSelect = document.getElementById('filterByCourse');
      if (!courseSelect) return;

      courseSelect.innerHTML = '<option value="">Filter by Course</option>';

      data.forEach(course => {
        console.log(course);
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.name} (${course.code})`;
        courseSelect.appendChild(option);
      });
    } catch (err) {
      showToast("error", "Failed to load course list.");
      console.error(err);
    }
  }

  async function fetchSessionsForCourse(courseId) {
    try {
      const res = await fetch(`${apiUrl}/api/session/by-course/${courseId}`);
      const { sessions = [] } = await res.json();
      const sessionSelect = document.getElementById('filterBySession');
      if (!sessionSelect) return;

      sessionSelect.innerHTML = '<option value="">All Sessions</option>';
      sessions.forEach(({ id }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `Session #${id}`;
        sessionSelect.appendChild(option);
      });
    } catch (err) {
      showToast("error", "Failed to load sessions.");
    }
  }

  // === ATTENDANCE ===
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
      if (!res.ok) throw new Error("Request failed");

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
      showToast("error", "Failed to fetch attendance.");
    }
  }

  // === EXPORT ===
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

  // === TABS / SIDEBAR / THEME ===
  function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.nav-link[onclick*="${id}"]`)?.classList.add('active');
  }

  function toggleSidebar() {
    if (window.innerWidth > 768) return;
    document.querySelector('.sidebar').classList.add('show');
    document.querySelector('.sidebar-backdrop').classList.add('active');
    document.body.classList.add('no-scroll');
  }

  function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('show');
    document.querySelector('.sidebar-backdrop').classList.remove('active');
    document.body.classList.remove('no-scroll');
  }

  function toggleCollapse() {
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebarCollapsed', isCollapsed ? 'yes' : 'no');
    }
  }

  function applyTheme() {
    const toggle = document.getElementById('themeSwitch');
    const isDark = localStorage.getItem('geoPresenceTheme') === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    if (toggle) toggle.checked = isDark;
  }

  // === ADD COURSE FORM ===
  const addForm = document.getElementById("addCourseForm");
  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const data = {
        course_code: formData.get("course_code"),
        course_name: formData.get("course_name"),
        department: formData.get("department"),
        semester: formData.get("semester")
      };

      const csrfToken = getCookie('csrf_access_token');

      fetch(`${apiUrl}/api/courses/`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getCookie('csrf_access_token')
        },
        credentials: "include",
        body: JSON.stringify(data)
      })
      .then(res => res.json().then(data => ({ status: res.status, body: data })))
      .then(({ status, body }) => {
        console.log("STATUS:", status);
        console.log("RESPONSE BODY:", body);

        if (status === 201) {
          showToast("success", body.message || "Course added!");
          this.reset();
          loadCourses();
        } else {
          if (body.error) {
            showToast("error", body.error);
          } else if (body.message) {
            showToast("info", body.message);
          } else {
            showToast("error", "Failed to add course.");
          }
        }
      })
      .catch(err => {
        console.error(err);
        showToast("error", "Something went wrong.");
      });
    });
  }

  // === INIT ===
  fetch(`${apiUrl}/api/admin/profile`, { credentials: "include" })
    .then(res => {
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    })
    .then(data => {
      const nameEl = document.getElementById("adminName");
      if (nameEl) nameEl.textContent = data.full_name || "Admin";
    })
    .catch(() => {
      alert("Please login first");
      window.location.href = "/login.html";
    });

  applyTheme();
  fetchCourses();
  fetchCoursesForDropdown();

  if (localStorage.getItem('sidebarCollapsed') === 'yes') {
    document.querySelector('.sidebar')?.classList.add('collapsed');
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  document.getElementById('themeSwitch')?.addEventListener('change', function () {
    document.body.classList.toggle('dark-mode', this.checked);
    localStorage.setItem('geoPresenceTheme', this.checked ? 'dark' : 'light');
  });

  document.getElementById('filterByCourse')?.addEventListener('change', e => {
    const courseId = e.target.value;
    if (courseId) fetchSessionsForCourse(courseId);
  });

  // Morris Charts
  const chartBlue = getComputedStyle(document.body).getPropertyValue('--primary').trim();

  new Morris.Bar({
    element: 'attendanceBarChart',
    data: [
      { day: 'Mon', attendance: 42 },
      { day: 'Tue', attendance: 56 },
      { day: 'Wed', attendance: 48 },
      { day: 'Thu', attendance: 60 },
      { day: 'Fri', attendance: 30 },
    ],
    xkey: 'day',
    ykeys: ['attendance'],
    labels: ['Attendance'],
    barColors: [chartBlue],
    hideHover: 'auto',
    resize: true
  });

  function renderDonut(data) {
    const chartWrapper = document.getElementById("courseDonutChart");
    const legendWrapper = document.getElementById("courseDonutLegend");
    if (!chartWrapper || !legendWrapper) return;

    const formatted = data
      .map(stat => ({
        label: stat.label || stat.department || stat.semester || stat.lecturer || "Unknown",
        value: stat.count
      }))
      .sort((a, b) => b.value - a.value);

    const total = formatted.reduce((sum, item) => sum + item.value, 0);
    const totalDisplay = document.getElementById("donutTotalCount");
    if (totalDisplay) totalDisplay.textContent = `Total: ${total}`;
    const threshold = 0.07 * total;

    const grouped = [];
    let otherCount = 0;

    formatted.forEach(item => {
      if (item.value < threshold) {
        otherCount += item.value;
      } else {
        grouped.push(item);
      }
    });

    if (otherCount > 0) {
      grouped.push({ label: "Other", value: otherCount });
    }

    chartWrapper.classList.add("fade-out");

    setTimeout(() => {
      chartWrapper.innerHTML = "";
      legendWrapper.innerHTML = "";

      donutChartInstance = new Morris.Donut({
        element: "courseDonutChart",
        data: grouped,
        resize: true,
        colors: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8', '#20c997', '#6610f2'],
        formatter: function (value, data) {
          return `${value}`;
        }
      });

      const topItem = grouped[0];
      const centerLabel = document.getElementById("donutCenterLabel");
      if (centerLabel && topItem) {
        centerLabel.innerHTML = `${topItem.label}<br>${topItem.value}`;
      }

      grouped.forEach((item, i) => {
        const color = donutChartInstance.options.colors[i % donutChartInstance.options.colors.length];
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        const percent = ((item.value / total) * 100).toFixed(1);
        legendItem.innerHTML = `
          <span class="legend-color" style="background-color: ${color};"></span>
          <span>${item.label} – ${percent}%</span>
        `;
        legendItem.addEventListener("click", () => {
          const filterType = document.getElementById("statType").value;

          if (filterType === "department") {
            document.getElementById("filterDepartment").value = item.label;
            applyCourseFilters();
          } else if (filterType === "semester") {
            document.getElementById("filterSemester").value = item.label;
            applyCourseFilters();
          } else {
            alert(`Filter not available for "${filterType}"`);
          }
        });
        legendWrapper.appendChild(legendItem);
      });

      chartWrapper.classList.remove("fade-out");
    }, 150);
  }

  function loadCourseStats(type = null) {
    const selectedType = type || document.getElementById("statType")?.value || "department";

    if (chartDataCache[selectedType]) {
      renderDonut(chartDataCache[selectedType]);
      return;
    }

    fetch(`/chart/course-stats?type=${selectedType}`, {
      credentials: "include"
    })
      .then(res => res.json())
      .then(data => {
        chartDataCache[selectedType] = data;
        renderDonut(data);
      })
      .catch(err => {
        console.error("Chart fetch failed:", err);
      });
  }

  // Redraw chart on resize
  window.addEventListener("resize", () => {
    if (donutChartInstance && typeof donutChartInstance.redraw === 'function') {
      donutChartInstance.redraw();
    }
  });

  // Export button functionality
  document.getElementById("exportDonutBtn")?.addEventListener("click", () => {
    const exportBtn = document.getElementById("exportDonutBtn");
    exportBtn.disabled = true;
    exportBtn.innerText = "Exporting...";

    const svgEl = document.querySelector("#courseDonutChart svg");
    if (!svgEl) {
      alert("Chart not loaded yet!");
      exportBtn.disabled = false;
      exportBtn.innerText = "Export Chart";
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = svgEl.clientWidth || 400;
      canvas.height = svgEl.clientHeight || 300;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.download = "course_stats.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;

    // Reset export button
    setTimeout(() => {
      exportBtn.disabled = false;
      exportBtn.innerText = "Export Chart";
    }, 2000);
  });


  // === LOGOUT ===
  function logout() {
    fetch(`${apiUrl}/logout`, {
      method: "POST",
      credentials: "include"
    }).then(() => {
      localStorage.removeItem("token_expiry");
      window.location.href = "/login.html";
    });
  }


});

