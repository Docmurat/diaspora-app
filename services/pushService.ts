// Пуш-уведомления (Веха 65). Работает только в браузере (сайт-PWA):
// Web Push — уведомления приходят, даже когда сайт закрыт.
//
// Подписка устройства хранится в public.push_subscriptions вместе с
// языком: почтальон send-push на сервере переводит текст пуша под язык
// каждого устройства (модераторские — всегда по-русски).
//
// Публичный ключ ниже не секретный. Пара создана владельцем
// (npx web-push generate-vapid-keys): приватная половина живёт только
// на сервере в ~/supabase/.env, запасная копия — C:\dev\Backups\vapid-keys.txt.
//
// На iPhone пуши работают только у сайта, добавленного на экран
// «Домой» (iOS 16.4+), — в обычном Safari браузер их не умеет.

import { Platform } from "react-native";

import { supabase } from "../lib/supabase";
import { getLanguage } from "./i18nService";

const VAPID_PUBLIC_KEY =
  "BBh2ry3YzFUkEEwOZ7F-NJNDYEWvZeHd5oOFpuOARskSvxoeY7ve7Y174L5XFTchb9DLqofKHq8RXooOhyQOYbI";

export type PushStatus =
  | "unsupported" // браузер не умеет пуши
  | "needsInstall" // iPhone: сначала добавить сайт на экран «Домой»
  | "denied" // человек запретил уведомления в браузере
  | "on" // включены на этом устройстве
  | "off"; // выключены (или ещё не включались)

function isWeb(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined";
}

export function isPushSupported(): boolean {
  return (
    isWeb() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIphoneWithoutInstall(): boolean {
  if (!isWeb()) return false;

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const standalone =
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as any).standalone === true;

  return isIos && !standalone;
}

// Ключ VAPID в виде байтов — так его понимают все браузеры.
function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

// Записывает (или обновляет) подписку этого браузера в базе:
// участник, адрес доставки, ключи и ЯЗЫК устройства.
async function saveSubscription(sub: PushSubscription): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const json = sub.toJSON();
  const keys = json.keys || {};
  if (!keys.p256dh || !keys.auth) return;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      lang: getLanguage(),
      user_agent: (navigator.userAgent || "").slice(0, 200),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) throw new Error(error.message);
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isWeb()) return "unsupported";
  if (!isPushSupported()) {
    return isIphoneWithoutInstall() ? "needsInstall" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";

  try {
    const sub = await getExistingSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return isIphoneWithoutInstall() ? "needsInstall" : "unsupported";
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  try {
    await saveSubscription(sub);
  } catch {
    // Подписка могла остаться от другой анкеты в этом браузере —
    // пересоздаём начисто и записываем заново.
    await sub.unsubscribe();
    const fresh = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    });
    await saveSubscription(fresh);
  }

  return "on";
}

export async function disablePush(): Promise<PushStatus> {
  try {
    const sub = await getExistingSubscription();
    if (sub) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    // даже если не вышло — статус пересчитается при следующем открытии
  }
  return "off";
}

// Тихая синхронизация: если пуши на этом устройстве включены,
// обновляет запись в базе (язык, участник). Зовётся при старте,
// при входе и при смене языка (components/PushBridge.tsx).
export async function syncPushSubscription(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    const sub = await getExistingSubscription();
    if (!sub) return;
    await saveSubscription(sub);
  } catch {
    // тихо: синхронизация никогда не мешает работе приложения
  }
}

// При выходе из аккаунта отключаем подписку этого браузера.
// Запись в базе стереть уже нельзя (мы вышли) — осиротевшую запись
// почтальон удалит сам при первой неудачной доставке (410 Gone).
export async function dropPushOnLogout(): Promise<void> {
  try {
    const sub = await getExistingSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    // не страшно
  }
}
