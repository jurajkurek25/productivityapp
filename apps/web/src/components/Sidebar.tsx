import { NavLink } from "react-router-dom";
import { CalendarDays, LayoutDashboard, LogOut, Settings, Sparkles, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { t } from "../lib/i18n";

const LINKS = [
  { to: "/", label: t.nav.dashboard, icon: LayoutDashboard },
  { to: "/goals", label: t.nav.goals, icon: Target },
  { to: "/calendar", label: t.nav.calendar, icon: CalendarDays },
  { to: "/study", label: t.nav.study, icon: Sparkles },
  { to: "/settings", label: t.nav.settings, icon: Settings },
];

export function Sidebar() {
  const { user, workspace, logout } = useAuth();

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          B
        </div>
        <span className="font-display text-base font-semibold tracking-tight text-slate-900">Balance</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <link.icon size={17} strokeWidth={2.25} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center justify-between rounded-lg px-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{workspace?.name ?? "Pracovný priestor"}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title={t.nav.logout}
            aria-label={t.nav.logout}
            className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </aside>
  );
}
