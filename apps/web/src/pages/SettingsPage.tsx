import { FormEvent, useEffect, useState } from "react";
import { LIFE_DOMAINS, type WeeklyCapacityTemplate } from "@productivityapp/core";
import { api, ApiError } from "../lib/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { domainLabels, t } from "../lib/i18n";

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function ExportCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const blob = await api.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `balance-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.settings.exportError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-slate-500">{t.settings.exportTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.settings.exportSubtitle}</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="button" variant="secondary" onClick={handleExport} disabled={busy}>
        {t.settings.exportButton}
      </Button>
    </Card>
  );
}

function AccountCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsError(false);
    if (newPassword !== confirmPassword) {
      setMessage(t.settings.passwordMismatch);
      setIsError(true);
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setMessage(t.settings.passwordChanged);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage(err instanceof ApiError ? t.settings.passwordChangeError : t.auth.somethingWrong);
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.settings.accountTitle}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.settings.currentPassword}</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.settings.newPassword}</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.settings.confirmPassword}</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        {message && <p className={`text-sm ${isError ? "text-red-600" : "text-emerald-600"}`}>{message}</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? t.settings.changingPassword : t.settings.changePassword}
        </Button>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  const [capacity, setCapacity] = useState<WeeklyCapacityTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCapacity()
      .then(setCapacity)
      .finally(() => setLoading(false));
  }, []);

  function updateCell(dayIndex: number, domain: (typeof LIFE_DOMAINS)[number], value: number) {
    if (!capacity) return;
    const days = capacity.days.map((d, i) => (i === dayIndex ? { ...d, [domain]: value } : d));
    setCapacity({ days });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!capacity) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updateCapacity(capacity);
      setMessage(t.settings.saved);
    } catch {
      setMessage(t.settings.error);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !capacity) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.settings.subtitle}</p>
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-slate-400"> </th>
                  {t.settings.dayNames.map((name) => (
                    <th key={name} className="px-2 py-2 text-center text-xs font-medium text-slate-500">
                      {name.slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LIFE_DOMAINS.map((domain) => (
                  <tr key={domain} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-xs font-medium text-slate-600">{domainLabels[domain]}</td>
                    {capacity.days.map((day, dayIndex) => (
                      <td key={dayIndex} className="px-1 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={day[domain]}
                          onChange={(e) => updateCell(dayIndex, domain, Number(e.target.value))}
                          className="w-16 rounded border border-slate-300 px-1.5 py-1 text-center text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {message && <p className="text-sm text-slate-500">{message}</p>}
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? t.settings.saving : t.settings.save}
          </Button>
        </form>
      </Card>
      <ExportCard />
      <AccountCard />
    </div>
  );
}
