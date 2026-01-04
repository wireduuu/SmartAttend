export function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

export function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
  }
}