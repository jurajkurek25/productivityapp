import { NavLink } from "react-router-dom";
import { CalendarDays, LayoutDashboard, LogOut, Sparkles, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { t } from "../lib/i18n";

const LINKS = [
  { to: "/", label: t.nav.dashboard, icon: LayoutDashboard },
  { to: "/goals", label: t.nav.goals, icon: Target },
  { to: "/calendar", label: t.nav.calendar, icon: CalendarDays },
  { to: "/study", label: t.nav.study, icon: Sparkles },
];

export function MobileHeader() {
  const { workspace, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
          B
        </div>
        <span className="truncate font-display text-sm font-semibold tracking-tight text-slate-900">
          {workspace?.name ?? "Balance"}
        </span>
      </div>
      <button
        onClick={logout}
        title={t.nav.logout}
        aria-label={t.nav.logout}
        className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <LogOut size={18} strokeWidth={2.25} />
      </button>
    </header>
  );
}

export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t.nav.dashboard}
    >
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive ? "text-brand-700" : "text-slate-400"
            }`
          }
        >
          <link.icon size={20} strokeWidth={2.25} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
