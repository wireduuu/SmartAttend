console.log("🎨 ui.js loaded");

// === SIDEBAR NAV LINK HIGHLIGHT ===
function highlightActiveNavLink() {
  const path = window.location.pathname; // e.g. "/sessions"
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });
}

// === SIDEBAR CONTROLS ===
function toggleSidebar() {
  if (window.innerWidth > 768) return;
  document.querySelector(".sidebar")?.classList.add("show");
  document.querySelector(".sidebar-backdrop")?.classList.add("active");
  document.body.classList.add("no-scroll");
}

function closeSidebar() {
  document.querySelector(".sidebar")?.classList.remove("show");
  document.querySelector(".sidebar-backdrop")?.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

function toggleCollapse() {
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector(".sidebar");
    sidebar?.classList.toggle("collapsed");
    const isCollapsed = sidebar?.classList.contains("collapsed");
    localStorage.setItem("sidebarCollapsed", isCollapsed ? "yes" : "no");
  }
}

// === THEME TOGGLING ===
function applyTheme() {
  const toggle = document.getElementById("themeSwitch");
  const isDark = localStorage.getItem("geoPresenceTheme") === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  if (toggle) toggle.checked = isDark;
}

// === INIT UI ON LOAD ===
document.addEventListener("DOMContentLoaded", () => {
  applyTheme();

  document.getElementById("themeSwitch")?.addEventListener("change", function () {
    const isDark = this.checked;
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("geoPresenceTheme", isDark ? "dark" : "light");
  });

  if (localStorage.getItem("sidebarCollapsed") === "yes") {
    document.querySelector(".sidebar")?.classList.add("collapsed");
  }

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  highlightActiveNavLink();
});

// === EXPORTS ===
export {
  toggleSidebar,
  closeSidebar,
  toggleCollapse,
  applyTheme,
};
