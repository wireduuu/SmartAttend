import { BookOpen, UserCheck, Clock, Users } from "lucide-react";
import ChartsGrid from "../../components/charts/ChartsGrid";

const stats = [
  {
    label: "Total Courses",
    value: 6,
    icon: BookOpen,
  },
  {
    label: "Attendance Rate",
    value: "87%",
    icon: UserCheck,
  },
  {
    label: "Active Sessions",
    value: 3,
    icon: Clock,
  },
  {
    label: "Registered Students",
    value: 142,
    icon: Users,
  },
];

export default function DashboardHome() {
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {/* Page Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your attendance system
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold mt-1">{value}</p>
                </div>

                <div className="p-3 rounded-lg bg-muted">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div>
          <ChartsGrid />
        </div>
      </div>
    </main>
  );
}
