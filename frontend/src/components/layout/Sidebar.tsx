import { NavLink } from "react-router-dom";
import { Home, Book, UserCheck, Clock, ChevronLeft } from "lucide-react";
import { useSidebar } from "../../hooks/useSidebar";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/courses", label: "Courses", icon: Book },
  { to: "/attendance", label: "Attendance", icon: UserCheck },
  { to: "/sessions", label: "Sessions", icon: Clock },
];

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen
        bg-sidebar-background border-r border-sidebar-border
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">
            GeoPresence
          </span>
        )}

        <button
          onClick={toggle}
          aria-label="Toggle sidebar"
          className="btn-ghost p-1 rounded-full"
        >
          <ChevronLeft
            className={`h-5 w-5 transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition
               ${
                 isActive
                   ? "bg-primary text-primary-foreground"
                   : "hover:bg-sidebar-accent hover:text-sidebar-foreground"
               }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
