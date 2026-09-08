import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { t } from "../lib/i18n";

export function MissedTasksBanner({ onRescheduled }: { onRescheduled?: () => void }) {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  function load() {
    api
      .getMissedCount()
      .then((r) => setCount(r.count))
      .catch(() => setCount(0));
  }

  useEffect(load, []);

  async function handleReschedule() {
    setBusy(true);
    try {
      await api.rescheduleMissed();
      load();
      onRescheduled?.();
    } finally {
      setBusy(false);
    }
  }

  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-card">
      <div className="flex items-center gap-2.5 text-sm text-amber-800">
        <AlertTriangle size={18} strokeWidth={2.25} className="shrink-0" />
        <span>{t.dashboard.missedBanner(count)}</span>
      </div>
      <button
        onClick={handleReschedule}
        disabled={busy}
        className="shrink-0 text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
      >
        {busy ? t.dashboard.rescheduling : t.dashboard.rescheduleMissed}
      </button>
    </div>
  );
}
