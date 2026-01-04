import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useState } from "react";

/* ================= MOCK DATA (replace with API later) ================= */

const attendanceData = [
  { day: "Mon", count: 42 },
  { day: "Tue", count: 55 },
  { day: "Wed", count: 48 },
  { day: "Thu", count: 60 },
  { day: "Fri", count: 50 },
];

const courseStats = {
  department: [
    { name: "CS", value: 18 },
    { name: "EE", value: 10 },
    { name: "ME", value: 7 },
  ],
  semester: [
    { name: "Sem 1", value: 15 },
    { name: "Sem 2", value: 12 },
    { name: "Sem 3", value: 8 },
  ],
  lecturer: [
    { name: "Dr. Mensah", value: 9 },
    { name: "Prof. Boateng", value: 11 },
    { name: "Mr. Owusu", value: 7 },
  ],
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

/* ===================================================================== */

export default function ChartsGrid() {
  const [statType, setStatType] =
    useState<keyof typeof courseStats>("department");

  const donutData = courseStats[statType];
  const total = donutData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ================= BAR CHART ================= */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4">
          Weekly Attendance Summary
        </h3>

        <div className="h-[240px] mt-12">
          <ResponsiveContainer
            width="100%"
            height="100%"
            className="pointer-events-none"
          >
            <BarChart data={attendanceData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                fill="hsl(var(--primary))"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= DONUT CHART ================= */}
      <div className="card">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Courses Overview</h3>

          <select
            value={statType}
            onChange={(e) =>
              setStatType(e.target.value as keyof typeof courseStats)
            }
            className="input w-40"
          >
            <option value="department">Department</option>
            <option value="semester">Semester</option>
            <option value="lecturer">Lecturer</option>
          </select>
        </div>

        {/* Chart */}
        <div className="h-[240px] relative">
          <ResponsiveContainer
            width="100%"
            height="100%"
            className="pointer-events-none"
          >
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {donutData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-xl font-semibold">{total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {donutData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
