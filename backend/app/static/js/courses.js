import { apiUrl, secureFetch, getCookie, showToast } from './utils.js';

console.log("📚 courses.js loaded");

let allCourses = [];
let editingCourseId = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("coursesTab")) return;  // Only run on courses page

  loadCourses();

  document.getElementById("resetFiltersBtn")?.addEventListener("click", resetCourseFilters);
  document.getElementById("filterDepartment")?.addEventListener("change", applyCourseFilters);
  document.getElementById("filterSemester")?.addEventListener("change", applyCourseFilters);

  document.getElementById("editCourseForm")?.addEventListener("submit", submitEditCourseForm);
  document.getElementById("addCourseForm")?.addEventListener("submit", submitAddCourseForm);
});

// === LOAD COURSES ===
async function fetchCourses() {
  const search = document.getElementById('searchInput')?.value || "";
  const department = document.getElementById("filterDepartment")?.value || "";
  const semester = document.getElementById("filterSemester")?.value || "";

  const url = `${apiUrl}/api/courses/all?search=${search}&department=${department}&semester=${semester}`;
  try {
    const res = await secureFetch(url);
    if (!res.ok) {
      showToast("error", "Failed to fetch courses.");
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.courses || [];
  } catch (err) {
    console.error(err);
    showToast("error", "Network error while loading courses.");
    return [];
  }
}

async function loadCourses() {
  const courses = await fetchCourses();
  if (courses) {
    allCourses = courses;
    populateFilterOptions(courses);
    renderCourses(courses);
  }
}

function renderCourses(courses) {
  const grid = document.getElementById('courseGrid');
  if (!grid) return;

  grid.innerHTML = courses.length
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

// === FILTER ===
function populateFilterOptions(courses) {
  const departments = [...new Set(courses.map(c => c.department).filter(Boolean))];
  const semesters = [...new Set(courses.map(c => c.semester).filter(Boolean))];

  const deptSelect = document.getElementById("filterDepartment");
  const semSelect = document.getElementById("filterSemester");

  if (!deptSelect || !semSelect) {
    console.warn("Filter select elements not found in DOM");
    return;  // safely exit if not present
  }

  deptSelect.innerHTML = '<option value="">All Departments</option>';
  semSelect.innerHTML = '<option value="">All Semesters</option>';

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

function applyCourseFilters() {
  const dept = document.getElementById("filterDepartment")?.value?.toLowerCase();
  const sem = document.getElementById("filterSemester")?.value?.toLowerCase();

  const filtered = allCourses.filter(course => {
    const cDept = course.department?.toLowerCase() || "";
    const cSem = course.semester?.toLowerCase() || "";
    return (!dept || cDept === dept) && (!sem || cSem === sem);
  });

  renderCourses(filtered);
}

function resetCourseFilters() {
  document.getElementById("filterDepartment").value = "";
  document.getElementById("filterSemester").value = "";
  renderCourses(allCourses);
}

// === MODAL HANDLING ===
function editCourse(id, code, name, dept, sem) {
  document.getElementById("editCourseId").value = id;
  document.getElementById("editCourseCode").value = code;
  document.getElementById("editCourseName").value = name;
  document.getElementById("editDepartment").value = dept;
  document.getElementById("editSemester").value = sem;

  document.getElementById("editCourseModal").style.display = "block";
  document.getElementById("modalOverlay").style.display = "block";
}

function closeEditCourseModal() {
  document.getElementById("editCourseModal").style.display = "none";
  document.getElementById("modalOverlay").style.display = "none";
}

// === SUBMIT EDIT ===
async function submitEditCourseForm(e) {
  e.preventDefault();
  const id = document.getElementById("editCourseId").value;
  const data = {
    course_code: document.getElementById("editCourseCode").value,
    course_name: document.getElementById("editCourseName").value,
    department: document.getElementById("editDepartment").value,
    semester: document.getElementById("editSemester").value,
  };

  try {
    const res = await secureFetch(`${apiUrl}/api/courses/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok) {
      showToast("success", "Course updated!");
      closeEditCourseModal();
      loadCourses();
    } else {
      showToast("error", result.error || "Update failed.");
    }
  } catch (err) {
    console.error(err);
    showToast("error", "Network error.");
  }
}

// === DELETE COURSE ===
async function deleteCourse(id) {
  if (!confirm("Are you sure you want to delete this course?")) return;

  try {
    const res = await secureFetch(`${apiUrl}/api/courses/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
    });

    const body = await res.json();
    if (res.ok) {
      showToast("success", "Course deleted.");
      loadCourses();
    } else {
      showToast("error", body.error || "Delete failed.");
    }
  } catch (err) {
    console.error(err);
    showToast("error", "Network error.");
  }
}

// === ADD COURSE ===
async function submitAddCourseForm(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const payload = {
    course_code: formData.get("course_code")?.trim(),
    course_name: formData.get("course_name")?.trim(),
    department: formData.get("department")?.trim(),
    semester: formData.get("semester")?.trim(),
  };

  // Validate required fields before sending
  if (!payload.course_code || !payload.course_name || !payload.department || !payload.semester) {
    showToast("error", "Please fill in all required fields.");
    return;
  }

  try {
    const res = await secureFetch(`${apiUrl}/api/courses/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify(payload),
    });

    let body;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }

    if (res.status === 201) {
      showToast("success", body.message || "Course added!");
      form.reset();
      loadCourses();
    } else {
      console.error('Error response body:', body);
      showToast("error", (body.error || body.message) || "Failed to add course.");
    }
  } catch (err) {
    console.error(err);
    showToast("error", "Something went wrong.");
  }
}


// === EXPOSE TO GLOBAL ===
window.App = {
  ...window.App,
  editCourse,
  deleteCourse,
  closeEditCourseModal,
};

export {
  applyCourseFilters,
  resetCourseFilters,
  fetchCourses,
  loadCourses,
  renderCourses
};