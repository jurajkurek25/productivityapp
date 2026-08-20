import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LIFE_DOMAINS, type Goal, type LifeDomain } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge } from "../components/DomainBadge";

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [domain, setDomain] = useState<LifeDomain>("business");
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  function load() {
    setLoading(true);
    api
      .listGoals()
      .then(setGoals)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.createGoal({ domain, title: title.trim(), targetDate: targetDate || undefined });
    setTitle("");
    setTargetDate("");
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "New goal"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as LifeDomain)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {LIFE_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Target date (optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grow my YouTube channel"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create goal
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-slate-400">No goals yet. Create one to get a suggested breakdown into steps.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {goals.map((g) => (
            <li key={g.id}>
              <Link to={`/goals/${g.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <div>
                  <p className="font-medium">{g.title}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <DomainBadge domain={g.domain} />
                    {g.targetDate && <span className="text-xs text-slate-400">Target: {g.targetDate}</span>}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-400">{g.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
