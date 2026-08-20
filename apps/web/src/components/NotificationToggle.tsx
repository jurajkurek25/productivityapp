import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { disablePush, enablePush, getExistingSubscription, isPushSupported } from "../lib/push";
import { t } from "../lib/i18n";
import { Card } from "./Card";

type Status = "checking" | "unsupported" | "off" | "on" | "enabling" | "error";

export function NotificationToggle() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    getExistingSubscription()
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  async function handleEnable() {
    setStatus("enabling");
    try {
      await enablePush();
      setStatus("on");
    } catch (err) {
      if (err instanceof Error && err.message === "blocked") {
        alert(t.notifications.blocked);
        setStatus("off");
      } else {
        setStatus("error");
      }
    }
  }

  async function handleDisable() {
    await disablePush().catch(() => {});
    setStatus("off");
  }

  if (status === "unsupported" || status === "checking") return null;

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 text-sm text-slate-600">
        {status === "on" ? (
          <Bell size={18} strokeWidth={2.25} className="shrink-0 text-brand-600" />
        ) : (
          <BellOff size={18} strokeWidth={2.25} className="shrink-0 text-slate-400" />
        )}
        <span>{status === "on" ? t.notifications.enabled : status === "error" ? t.notifications.error : t.notifications.enable}</span>
      </div>
      {status === "on" ? (
        <button onClick={handleDisable} className="shrink-0 text-sm font-medium text-slate-400 hover:text-slate-600">
          {t.notifications.disable}
        </button>
      ) : (
        <button
          onClick={handleEnable}
          disabled={status === "enabling"}
          className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          {status === "enabling" ? t.notifications.enabling : t.notifications.enable}
        </button>
      )}
    </Card>
  );
}
