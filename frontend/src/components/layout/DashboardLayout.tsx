import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { SidebarProvider } from "../../providers/SidebarProvider";
import { useSidebar } from "../../hooks/useSidebar";

function DashboardContent() {
  const { collapsed } = useSidebar();

  return (
    <div
      className={`flex-1 min-h-screen transition-all duration-300
        ${collapsed ? "ml-20" : "ml-64"}
      `}
    >
      <Topbar />

      <main className="p-6 bg-background min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex bg-background">
        <Sidebar />
        <DashboardContent />
      </div>
    </SidebarProvider>
  );
}
