import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { NavBar } from "./components/NavBar";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GoalsPage } from "./pages/GoalsPage";
import { GoalDetailPage } from "./pages/GoalDetailPage";
import { CalendarPage } from "./pages/CalendarPage";
import { StudyPage } from "./pages/StudyPage";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
