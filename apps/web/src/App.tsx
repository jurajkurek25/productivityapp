import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Sidebar } from "./components/Sidebar";
import { MobileHeader, MobileNav } from "./components/MobileNav";
import { PomodoroWidget } from "./components/PomodoroWidget";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GoalsPage } from "./pages/GoalsPage";
import { GoalDetailPage } from "./pages/GoalDetailPage";
import { CalendarPage } from "./pages/CalendarPage";
import { StudyPage } from "./pages/StudyPage";
import { SettingsPage } from "./pages/SettingsPage";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-8 sm:py-8 md:pb-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
      <MobileNav />
      <PomodoroWidget />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedShell>
            <DashboardPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedShell>
            <GoalsPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/goals/:id"
        element={
          <ProtectedShell>
            <GoalDetailPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedShell>
            <CalendarPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/study"
        element={
          <ProtectedShell>
            <StudyPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedShell>
            <SettingsPage />
          </ProtectedShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
