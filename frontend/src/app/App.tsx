import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ProtectedRoute from "./ProtectedRoute";
import DashboardLayout from "../components/layout/DashboardLayout";
import DashboardHome from "../pages/dashboard/DashboardHome";
import Courses from "../pages/dashboard/Courses";
import Attendance from "../pages/dashboard/Attendance";
import Sessions from "../pages/dashboard/Sessions";
import { SidebarProvider } from "../providers/SidebarProvider";

function App() {
  return (
    <SidebarProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/sessions" element={<Sessions />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </SidebarProvider>
  );
}

export default App;
