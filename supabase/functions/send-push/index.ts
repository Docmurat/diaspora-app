// Почтальон пушей «Минги-Тау» (Веха 65).
//
// Кто зовёт: триггер базы trg_notify_push — при рождении каждого
// НЕтихого уведомления в public.notifications (тихие «Выходного»
// с is_read=true в пуш не идут).
//
// Что делает: находит уведомление, берёт все подписки участника из
// public.push_subscriptions и отправляет Web Push на каждую — на языке
// устройства (перевод в i18n.ts, серверная копия notificationI18n.ts).
// Модераторские уведомления (is_moderation_task) — всегда по-русски.
//
// Хитрость чата: для «Новое сообщение:» почтальон ждёт 3 секунды и
// проверяет, жива ли запись. Если человек сидит в этом диалоге,
// приложение её уже стёрло (app/chat.tsx) — пуш не отправляется.
//
// Подпись отправки — VAPID-ключи из ~/supabase/.env; вход только со
// своим секретом PUSH_SECRET (его знает лишь триггер базы).
// Криптография Web Push (RFC 8291/8292) — на встроенном WebCrypto,
// без внешних библиотек: нечему ломаться при обновлениях.
//
// @ts-nocheck — файл для Deno (сервер), обычная проверка VS Code к нему не применима

import { createClient } from "npm:@supabase/supabase-js@2";

import { localizeNotification } from "./i18n.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "https://mingi-tau.ru";
const PUSH_SECRET = Deno.env.get("PUSH_SECRET") ?? "";

const MESSAGE_TITLE_PREFIX = "Новое сообщение:";
const MESSAGE_RECHECK_DELAY_MS = 3000; // человек в диалоге? запись успеют стереть
const BODY_MAX_CHARS = 240; // длинные тела в пуше обрезаем
const PUSH_TTL_SECONDS = 24 * 60 * 60; // сутки храним недоставленный пуш

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- База64-url и байты -------------------------------------------------

const textEncoder = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const bin = atob(withPad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// --- Подпись VAPID (RFC 8292): краткий пропуск от нашего сервера --------

async function vapidAuthHeader(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;

  const header = bytesToB64url(
    textEncoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const claims = bytesToB64url(
    textEncoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: VAPID_SUBJECT,
      }),
    ),
  );

  // Приватный ключ — 32 байта d; координаты x/y берём из публичного.
  const publicBytes = b64urlToBytes(VAPID_PUBLIC_KEY); // 65 байт, 0x04 + x + y
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(publicBytes.slice(1, 33)),
    y: bytesToB64url(publicBytes.slice(33, 65)),
    d: VAPID_PRIVATE_KEY,
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      textEncoder.encode(`${header}.${claims}`),
    ),
  );

  const jwt = `${header}.${claims}.${bytesToB64url(signature)}`;
  return `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;
}

// --- Шифрование содержимого (RFC 8291, aes128gcm) -----------------------

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  p256dh: string,
  auth: string,
  payload: string,
): Promise<Uint8Array> {
  const userPublicBytes = b64urlToBytes(p256dh);
  const authSecret = b64urlToBytes(auth);

  const userPublicKey = await crypto.subtle.importKey(
    "raw",
    userPublicBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const localKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const localPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeys.publicKey),
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: userPublicKey },
      localKeys.privateKey,
      256,
    ),
  );

  const keyInfo = concatBytes(
    textEncoder.encode("WebPush: info\0"),
    userPublicBytes,
    localPublicBytes,
  );
  const prk = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(
    salt,
    prk,
    textEncoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    prk,
    textEncoder.encode("Content-Encoding: nonce\0"),
    12,
  );

  // 0x02 в конце — знак «последняя запись» формата aes128gcm.
  const plaintext = concatBytes(
    textEncoder.encode(payload),
    new Uint8Array([2]),
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      plaintext,
    ),
  );

  // Заголовок aes128gcm: соль(16) + размер записи 4096(4) + длина ключа(1) + ключ(65).
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([localPublicBytes.length]),
    localPublicBytes,
    ciphertext,
  );
}

// --- Отправка одного пуша ----------------------------------------------

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
): Promise<number> {
  const [body, authorization] = await Promise.all([
    encryptPayload(p256dh, auth, payload),
    vapidAuthHeader(endpoint),
  ]);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(PUSH_TTL_SECONDS),
      Urgency: "normal",
    },
    body,
    // Висящий запрос обрывается сам и попадает в журнал ошибкой,
    // а не молча съедает время работника.
    signal: AbortSignal.timeout(10_000),
  });

  // Тело ответа не нужно, но дочитываем, чтобы соединение закрылось чисто.
  await res.arrayBuffer().catch(() => {});
  return res.status;
}

// --- Основная работа ----------------------------------------------------

// Журнал почтальона пишется в базу (public.push_log): журнал контейнера
// в этой версии edge-runtime строки функций наружу не отдаёт.
async function plog(supabase: any, note: string): Promise<void> {
  try {
    console.log("send-push:", note);
    await supabase.from("push_log").insert({ note });
  } catch {
    // журнал никогда не мешает доставке
  }
}

async function handleNotification(notificationId: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: n } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .maybeSingle();

  await plog(supabase, "взял уведомление " + notificationId);

  if (!n || n.is_read) {
    await plog(supabase, "записи нет или тихая — пуш не нужен");
    return;
  }

  // Чат: даём приложению 3 секунды стереть запись, если человек в диалоге.
  if (String(n.title || "").startsWith(MESSAGE_TITLE_PREFIX)) {
    await new Promise((resolve) =>
      setTimeout(resolve, MESSAGE_RECHECK_DELAY_MS),
    );

    const { data: still } = await supabase
      .from("notifications")
      .select("id, is_read")
      .eq("id", notificationId)
      .maybeSingle();

    if (!still || still.is_read) {
      await plog(supabase, "человек в диалоге, запись стёрта — пуш не нужен");
      return;
    }
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, lang")
    .eq("user_id", n.user_id);

  await plog(supabase, "подписок у участника: " + (subs ? subs.length : 0));
  if (!subs || subs.length === 0) return;

  for (const sub of subs) {
    await plog(supabase, "отправляю на " + new URL(sub.endpoint).host);
    // Модераторские — по-русски; остальные — на языке устройства.
    const lang =
      n.is_moderation_task === true
        ? "ru"
        : sub.lang === "en" || sub.lang === "kb"
          ? sub.lang
          : "ru";

    const shown = localizeNotification(
      { title: String(n.title || ""), body: n.body ?? null },
      lang,
    );

    const payload = JSON.stringify({
      title: shown.title,
      body: (shown.body || "").slice(0, BODY_MAX_CHARS),
      link: n.link || "/notifications",
      tag: n.id,
    });

    try {
      const status = await sendWebPush(
        sub.endpoint,
        sub.p256dh,
        sub.auth,
        payload,
      );

      // 404/410 — подписка умерла (браузер отключил или человек вышел):
      // тихо прибираем за собой.
      await plog(supabase, "доставка " + sub.id + " → код " + status);

      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    } catch (e) {
      await plog(
        supabase,
        "ошибка доставки " +
          sub.id +
          ": " +
          String(e && e.message ? e.message : e).slice(0, 120),
      );
    }
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Только POST" }, 405);
    }

    // Вход только для триггера базы — по общему секрету.
    if (!PUSH_SECRET || req.headers.get("x-push-secret") !== PUSH_SECRET) {
      return json({ error: "Нет доступа" }, 401);
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("send-push: не заданы VAPID-ключи в окружении");
      return json({ error: "Почтальон не настроен" }, 500);
    }

    const { notification_id } = await req.json();
    if (!notification_id) {
      return json({ error: "Нужен notification_id" }, 400);
    }

    const work = handleNotification(String(notification_id)).catch((e) =>
      console.error("send-push error:", e),
    );

    // Базе отвечаем сразу, доставляем в фоне: у вызова из триггера
    // короткое терпение, а чатовые пуши ждут свои 3 секунды.
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(work);
    } else {
      await work;
    }

    return json({ accepted: true });
  } catch (e) {
    console.error("send-push error:", e);
    return json({ error: "Внутренняя ошибка почтальона пушей" }, 500);
  }
});
