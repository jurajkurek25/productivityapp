import { api } from "./api";

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  return registration.pushManager.getSubscription();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("unsupported");
  if (Notification.permission === "denied") throw new Error("blocked");

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("blocked");

  const { publicKey } = await api.getPushPublicKey();
  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }),
      15000
    ));

  await api.subscribePush(subscription.toJSON() as PushSubscriptionJSON);
}

export async function disablePush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  await api.unsubscribePush(subscription.endpoint);
  await subscription.unsubscribe();
}
