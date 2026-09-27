// «Без сети» (Веха 70, шаг 1).
//
// 1) ПАМЯТЬ ЗАПУСКА: после каждого удачного запуска с сетью запоминаем на
//    телефоне, КТО вошёл и КУДА его вести (одобрен → внутрь, ожидает →
//    экран ожидания и т.д.). Без сети приложение открывается по этой
//    памяти, а не висит в ожидании сервера. Как только сеть появится,
//    часовой AccountGuard сам перепроверит анкету (блокировку/удаление).
//    Память (и сохранённая переписка, lib/chatCache.ts) стирается при
//    выходе из аккаунта.
// 2) ЕСТЬ ЛИ СЕТЬ: лёгкий «стук» в сервер (проверка здоровья входа) —
//    раз в 30 секунд, пока сеть есть, и раз в 5 секунд, пока её нет
//    (чтобы плашка «Нет соединения» быстро исчезла). Только пока
//    приложение на экране. Своя библиотека не нужна — новый APK не нужен.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────
// Ожидание с потолком: сеть «полумёртвая» — не ждём вечно.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// ─────────────────────────────────────────────────────────────────────
// ПАМЯТЬ ЗАПУСКА
export type LaunchRoute = "approved" | "pending" | "blocked" | "deleted";

type LaunchMemory = {
  userId: string;
  route: LaunchRoute;
  savedAt: string;
};

const LAUNCH_KEY = "mingi.launch.v1";

export async function readLaunchMemory(): Promise<LaunchMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(LAUNCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.route) return null;
    return parsed as LaunchMemory;
  } catch {
    return null;
  }
}

export async function saveLaunchMemory(
  userId: string,
  route: LaunchRoute,
): Promise<void> {
  try {
    const value: LaunchMemory = {
      userId,
      route,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(LAUNCH_KEY, JSON.stringify(value));
  } catch {
    // память — удобство, не обязанность
  }
}

export async function clearLaunchMemory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAUNCH_KEY);
  } catch {
    // ничего страшного
  }
}

// Выход из аккаунта (кнопка «Выйти» или сервер отозвал вход) — память
// стираем, чтобы без сети не открыть приложение от чужого имени.
let signOutWatcherStarted = false;

export function startSignOutWatcher(): void {
  if (signOutWatcherStarted) return;
  signOutWatcherStarted = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      clearLaunchMemory();
      // Переписка, сохранённая для работы без сети (шаг 2), — тоже.
      // Подключаем по требованию, чтобы файлы не ссылались друг на
      // друга при загрузке.
      import("./chatCache")
        .then((m) => m.clearChatCache())
        .catch(() => {});
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// ЕСТЬ ЛИ СЕТЬ
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const ONLINE_EVERY_MS = 30000;
const OFFLINE_EVERY_MS = 5000;
const PING_TIMEOUT_MS = 6000;
// Плашку показываем только после ДВУХ неудач подряд — одиночный сбой
// (лифт, туннель на секунду) не должен мигать на экране.
const FAILS_TO_SHOW = 2;

let online = true;
let failsInRow = 0;
let pingTimer: ReturnType<typeof setTimeout> | null = null;
let pinging = false;
let started = false;
const listeners = new Set<() => void>();

function setOnline(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((fn) => fn());
}

async function pingOnce(): Promise<boolean> {
  if (!SUPABASE_URL) return true;
  try {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: SUPABASE_KEY },
      }),
      PING_TIMEOUT_MS,
    );
    // Любой ответ сервера (даже ошибка) значит: связь есть.
    return !!res;
  } catch {
    return false;
  }
}

function scheduleNext() {
  if (pingTimer) clearTimeout(pingTimer);
  pingTimer = setTimeout(checkNow, online ? ONLINE_EVERY_MS : OFFLINE_EVERY_MS);
}

export async function checkNow(): Promise<void> {
  if (pinging) return;
  pinging = true;
  try {
    const ok = await pingOnce();
    if (ok) {
      failsInRow = 0;
      setOnline(true);
    } else {
      failsInRow += 1;
      if (failsInRow >= FAILS_TO_SHOW) setOnline(false);
    }
  } finally {
    pinging = false;
    if (AppState.currentState === "active") scheduleNext();
  }
}

function startWatching() {
  if (started) return;
  started = true;
  checkNow();

  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      checkNow();
    } else if (pingTimer) {
      clearTimeout(pingTimer);
      pingTimer = null;
    }
  });
}

// Для экранов: const isOnline = useOnline();
export function useOnline(): boolean {
  startWatching();
  return useSyncExternalStore(
    (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => online,
    () => online,
  );
}
