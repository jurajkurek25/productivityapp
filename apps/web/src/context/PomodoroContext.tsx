import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../lib/i18n";

export type PomodoroPhase = "work" | "break";

export interface PomodoroSession {
  taskId: string;
  taskTitle: string;
  phase: PomodoroPhase;
  workMinutes: number;
  breakMinutes: number;
  /** Epoch ms the current phase ends at; null while paused. */
  endsAt: number | null;
  /** Authoritative remaining ms while paused; ignored (derived from endsAt) while running. */
  remainingMs: number;
  cyclesCompleted: number;
}

const STORAGE_KEY = "balance.pomodoro";
const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

function loadSession(): PomodoroSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PomodoroSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: PomodoroSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-192.png", tag: "balance-pomodoro" });
  } catch {
    // Notification construction can throw in some contexts (e.g. service worker required on some browsers) — non-critical.
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio unavailable or blocked — the in-app widget already shows the transition, so this is just a bonus cue.
  }
}

interface PomodoroContextValue {
  session: PomodoroSession | null;
  remainingMs: number;
  start: (taskId: string, taskTitle: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PomodoroSession | null>(loadSession);
  const [now, setNow] = useState(Date.now());
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      const current = sessionRef.current;
      if (!current || current.endsAt === null) return;
      if (Date.now() < current.endsAt) return;

      if (current.phase === "work") {
        notify(t.pomodoro.workDoneTitle, t.pomodoro.workDoneBody(current.taskTitle));
        beep();
        setSession({
          ...current,
          phase: "break",
          endsAt: Date.now() + current.breakMinutes * 60_000,
          remainingMs: current.breakMinutes * 60_000,
          cyclesCompleted: current.cyclesCompleted + 1,
        });
      } else {
        notify(t.pomodoro.breakDoneTitle, t.pomodoro.breakDoneBody(current.taskTitle));
        beep();
        setSession({
          ...current,
          phase: "work",
          endsAt: Date.now() + current.workMinutes * 60_000,
          remainingMs: current.workMinutes * 60_000,
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function start(taskId: string, taskTitle: string) {
    const current = sessionRef.current;
    if (current && current.taskId !== taskId) {
      if (!confirm(t.pomodoro.confirmSwitch)) return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setSession({
      taskId,
      taskTitle,
      phase: "work",
      workMinutes: DEFAULT_WORK_MINUTES,
      breakMinutes: DEFAULT_BREAK_MINUTES,
      endsAt: Date.now() + DEFAULT_WORK_MINUTES * 60_000,
      remainingMs: DEFAULT_WORK_MINUTES * 60_000,
      cyclesCompleted: 0,
    });
  }

  function pause() {
    setSession((s) => {
      if (!s || s.endsAt === null) return s;
      return { ...s, endsAt: null, remainingMs: Math.max(0, s.endsAt - Date.now()) };
    });
  }

  function resume() {
    setSession((s) => {
      if (!s || s.endsAt !== null) return s;
      return { ...s, endsAt: Date.now() + s.remainingMs };
    });
  }

  function stop() {
    setSession(null);
  }

  const remainingMs = session ? (session.endsAt !== null ? Math.max(0, session.endsAt - now) : session.remainingMs) : 0;

  return (
    <PomodoroContext.Provider value={{ session, remainingMs, start, pause, resume, stop }}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used within PomodoroProvider");
  return ctx;
}
