import { apiUrl, secureFetch, showToast } from './utils.js';
import { applyCourseFilters } from './courses.js';

console.log("📈 charts.js loaded");
window.apiUrl = "http://127.0.0.1:5000"; // Change if needed for deployment

const Morris = window.Morris; // Access global Morris.js

let donutChartInstance = null;
const chartDataCache = {};

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  initCourseDropdown();
  initExportButton();
  initResizeHandler();
  renderBarChart();
});

// ====== EVENT INITIALIZERS ======
function initCourseDropdown() {
  const dropdown = document.getElementById("statType");
  if (!dropdown) return;

  dropdown.addEventListener("change", e => loadCourseStats(e.target.value));
  loadCourseStats(dropdown.value || "department");
}

function initExportButton() {
  const btn = document.getElementById("exportDonutBtn");
  if (btn) btn.addEventListener("click", exportDonutChart);
}

function initResizeHandler() {
  window.addEventListener("resize", () => {
    if (donutChartInstance?.redraw) donutChartInstance.redraw();
  });
}

// ====== LOAD COURSE STATS ======
async function loadCourseStats(type = "department") {
  if (chartDataCache[type]) {
    renderDonut(chartDataCache[type]);
    return;
  }

  try {
    const res = await fetch(`${window.apiUrl}/chart/course-stats?type=${type}`, {
      credentials: 'include',
    });
    const data = await res.json();
    chartDataCache[type] = data;
    renderDonut(data);
  } catch (err) {
    console.error("Chart fetch error:", err);
    showToast("error", "Could not load chart data.");
  }
}

// ====== RENDER DONUT ======
function renderDonut(rawData) {
  const chartEl = document.getElementById("courseDonutChart");
  const legendEl = document.getElementById("courseDonutLegend");
  if (!chartEl || !legendEl) {
    console.warn("Donut chart container or legend not found. Skipping rendering.");
    return;
  }

  const formatted = rawData.map(stat => ({
    label: stat.label || stat.department || stat.semester || stat.lecturer || "Unknown",
    value: stat.count
  })).sort((a, b) => b.value - a.value);

  const total = formatted.reduce((sum, item) => sum + item.value, 0);
  const groupedData = groupSmallValues(formatted, total);

  updateTotalDisplay(total);
  fadeOut(chartEl);

  setTimeout(() => {
    chartEl.innerHTML = "";
    legendEl.innerHTML = "";

    donutChartInstance = new Morris.Donut({
      element: "courseDonutChart",
      data: groupedData,
      resize: true,
      colors: getChartColors(),
      formatter: value => `${value}`
    });

    updateCenterLabel(groupedData);
    buildLegend(groupedData, total, legendEl);

    fadeIn(chartEl);
  }, 150);
}

function groupSmallValues(data, total) {
  const threshold = 0.07 * total;
  const grouped = [];
  let otherCount = 0;

  data.forEach(item => {
    if (item.value < threshold) {
      otherCount += item.value;
    } else {
      grouped.push(item);
    }
  });

  if (otherCount > 0) grouped.push({ label: "Other", value: otherCount });
  return grouped;
}

function updateTotalDisplay(total) {
  const totalEl = document.getElementById("donutTotalCount");
  if (totalEl) totalEl.textContent = `Total: ${total}`;
}

function updateCenterLabel(groupedData) {
  const centerLabel = document.getElementById("donutCenterLabel");
  if (centerLabel && groupedData.length) {
    const top = groupedData[0];
    centerLabel.innerHTML = `${top.label}<br>${top.value}`;
  }
}

function buildLegend(data, total, legendEl) {
  data.forEach((item, i) => {
    const color = donutChartInstance.options.colors[i % donutChartInstance.options.colors.length];
    const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;

    const legendItem = document.createElement("div");
    legendItem.className = "legend-item";
    legendItem.innerHTML = `
      <span class="legend-color" style="background-color: ${color};"></span>
      <span>${item.label} – ${percent}%</span>
    `;

    legendItem.addEventListener("click", () => handleLegendClick(item.label));
    legendEl.appendChild(legendItem);
  });
}

function handleLegendClick(label) {
  const statType = document.getElementById("statType").value;
  if (statType === "department") {
    document.getElementById("filterDepartment").value = label;
    applyCourseFilters();
  } else if (statType === "semester") {
    document.getElementById("filterSemester").value = label;
    applyCourseFilters();
  } else {
    alert(`Filter not supported for "${statType}"`);
  }
}

function getChartColors() {
  return [
    '#007bff', '#28a745', '#ffc107', '#dc3545',
    '#6f42c1', '#17a2b8', '#20c997', '#6610f2'
  ];
}

function fadeOut(el) {
  el.classList.add("fade-out");
}
function fadeIn(el) {
  el.classList.remove("fade-out");
}

// ====== BAR CHART ======
function renderBarChart() {
  const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim();

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
    barColors: [primaryColor],
    hideHover: 'auto',
    resize: true
  });
}

// ====== EXPORT CHART ======
function exportDonutChart() {
  const exportBtn = document.getElementById("exportDonutBtn");
  if (!exportBtn) return;

  setExportButtonState(exportBtn, true, "Exporting...");

  const svg = document.querySelector("#courseDonutChart svg");
  if (!svg) return resetExportBtn(exportBtn, "Chart not ready.");

  const svgData = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    drawSvgToCanvas(img, svg, exportBtn);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function drawSvgToCanvas(img, svg, exportBtn) {
  const canvas = document.createElement("canvas");
  canvas.width = svg.clientWidth || 400;
  canvas.height = svg.clientHeight || 300;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const link = document.createElement("a");
  link.download = "course_stats.png";
  link.href = canvas.toDataURL("image/png");
  link.click();

  setExportButtonState(exportBtn, false, "Export Chart");
}

function resetExportBtn(btn, msg) {
  alert(msg);
  setExportButtonState(btn, false, "Export Chart");
}

function setExportButtonState(btn, disabled, text) {
  btn.disabled = disabled;
  btn.innerText = text;
}
