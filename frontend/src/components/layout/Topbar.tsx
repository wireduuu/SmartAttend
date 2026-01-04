import { Menu, Moon, Sun, LogOut } from "lucide-react";
import { useSidebar } from "../../hooks/useSidebar";
import { useAuth } from "../../hooks/useAuth";

export default function Topbar() {
  const { toggle } = useSidebar();
  const { user, logout } = useAuth();

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  };

  return (
    <header
      className="h-16 flex items-center justify-between
      border-b bg-card px-6"
    >
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="btn-ghost p-2">
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="font-semibold">
            Welcome, {user?.full_name ?? "Admin"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage courses, sessions & attendance
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggleTheme} className="btn-ghost p-2">
          <Sun className="w-5 h-5 dark:hidden" />
          <Moon className="w-5 h-5 hidden dark:block" />
        </button>

        <button onClick={logout} className="btn-ghost p-2">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
