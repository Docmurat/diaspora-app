// Служба переводов (Веха 64). Три языка: русский (по умолчанию),
// английский, карачаевский. Словарь — services/translations.ts
// (автосгенерирован из таблицы владельца, вручную не правится).
//
// Как пользоваться на экранах:
//   import { t, useLanguage } from "../services/i18nService";
//   const lang = useLanguage(); // подписка: экран сам перерисуется при смене
//   <Text>{t("welcome.signIn")}</Text>
//   t("register.stepOf", { N: 2 })  // подстановки в фигурных скобках
//
// Выбор языка запоминается: на телефоне — AsyncStorage (как вход
// Supabase в lib/supabase.ts), в браузере — хранилище браузера.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { CATEGORY_LABELS, Lang, STRINGS } from "./translations";

const STORAGE_KEY = "mingi-language";

let currentLang: Lang = "ru";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function isLang(v: unknown): v is Lang {
  return v === "ru" || v === "en" || v === "kb";
}

// --- Запоминание выбора -------------------------------------------------

async function readSaved(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      // Браузер: то же хранилище, где Supabase держит вход.
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    }
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // хранилище недоступно — останемся на русском
  }
}

async function writeSaved(lang: Lang): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, lang);
      }
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // не смогли запомнить — не страшно, выбор доживёт до перезапуска
  }
}

// Самозапуск при первом импорте: поднимаем сохранённый выбор.
readSaved().then((saved) => {
  if (isLang(saved) && saved !== currentLang) {
    currentLang = saved;
    notify();
  }
});

// --- Публичные функции --------------------------------------------------

export function getLanguage(): Lang {
  return currentLang;
}

export function setLanguage(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  notify();
  writeSaved(lang);
}

// Подписка для экранов: const lang = useLanguage();
// Экран перерисуется сам при смене языка.
export function useLanguage(): Lang {
  return useSyncExternalStore(
    (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => currentLang,
    () => currentLang,
  );
}

// Перевод по ключу. Нет перевода (null в словаре или ключ не найден) —
// показываем русский: так юртексты и служебные строки остаются
// по-русски на любом языке (решение владельца).
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const entry = STRINGS[key];
  let text: string;
  if (!entry) {
    // Ключа нет в словаре — показываем сам ключ, чтобы дыру было видно
    // при проверке, а не пустое место.
    text = key;
  } else if (currentLang === "en") {
    text = entry.en ?? entry.ru;
  } else if (currentLang === "kb") {
    text = entry.kb ?? entry.ru;
  } else {
    text = entry.ru;
  }

  if (params) {
    for (const name of Object.keys(params)) {
      text = text.split(`{${name}}`).join(String(params[name]));
    }
  }
  return text;
}

// Показ сферы деятельности: в базе значение хранится по-русски,
// переводится только то, что видит человек.
export function tCategory(ruValue: string): string {
  const entry = CATEGORY_LABELS[ruValue];
  if (!entry) return ruValue;
  if (currentLang === "en") return entry.en ?? ruValue;
  if (currentLang === "kb") return entry.kb ?? ruValue;
  return ruValue;
}

// Локаль для дат и времени (чаты, карточки постов, инвайты):
// toLocaleTimeString(dateLocale()) вместо жёсткого "ru-RU".
// Карачаевский формат дат — русский (решение владельца: месяцы и
// форматы остаются русскими).
export function dateLocale(): string {
  return currentLang === "en" ? "en-GB" : "ru-RU";
}
