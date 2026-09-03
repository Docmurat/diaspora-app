// Почтальон «Минги-Тау»: отправляет и проверяет коды подтверждения почты.
// Отправка — через ящик проекта на Яндексе (данные лежат в секретах).
// ВАЖНО (03.09.2026): библиотека denomailer в среде функций подвисала
// намертво (early termination без ошибок) — заменена прямым SMTP-диалогом
// с smtp.yandex.ru:465, с таймаутами и журналом каждого шага.
// @ts-nocheck — файл для Deno (сервер), обычная проверка VS Code к нему не применима

import { createClient } from "npm:@supabase/supabase-js@2";

// ВАЖНО: тема письма — только латиница.
// Кириллица в заголовке в прошлой версии превращалась в крякозябры.
// Русский текст живёт внутри письма (html/plain) — там всё в порядке.

const CODE_TTL_MINUTES = 10; // сколько живёт код
const RESEND_COOLDOWN_SECONDS = 60; // пауза между отправками
const MAX_ATTEMPTS = 5; // попыток ввода кода
const SMTP_TIMEOUT_MS = 25000; // предохранитель: дольше не ждём

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildHtml(code: string) {
  return `<!DOCTYPE html>
<html lang="ru">
<body style="margin:0;padding:0;background:#F4FAF4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4FAF4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#FFFFFF;border-radius:20px;padding:32px 28px;border:1px solid #DCEBE1;">
        <tr><td align="center" style="font-size:26px;font-weight:bold;color:#3F6B5B;padding-bottom:4px;">Минги-Тау</td></tr>
        <tr><td align="center" style="font-size:11px;letter-spacing:3px;color:#719686;padding-bottom:20px;">КАРАЧАЕВО-БАЛКАРСКОЕ СООБЩЕСТВО</td></tr>
        <tr><td align="center" style="font-size:15px;color:#4E7364;line-height:22px;padding-bottom:20px;">Код подтверждения для завершения регистрации</td></tr>
        <tr><td align="center" style="padding-bottom:20px;">
          <div style="display:inline-block;background:#EDF7F0;border:1px solid #9FC5AF;border-radius:16px;padding:16px 28px;font-size:32px;letter-spacing:8px;color:#3F6B5B;font-weight:bold;">${code}</div>
        </td></tr>
        <tr><td align="center" style="font-size:13px;color:#7E988B;line-height:20px;">Код действует ${CODE_TTL_MINUTES} минут.<br>Если вы не регистрировались в «Минги-Тау», просто удалите это письмо.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------- Прямой SMTP-разговор с Яндексом ----------

// Текст → base64 (для писем в UTF-8 и для логина/пароля)
function b64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// base64 длинными строками почта не любит — режем по 76 символов
function b64wrap(text: string) {
  return b64(text)
    .replace(/(.{76})/g, "$1\r\n")
    .trim();
}

// Письмо целиком: заголовки + текстовая и html-версии
function buildMime(
  from: string,
  to: string,
  subject: string,
  plain: string,
  html: string,
) {
  const boundary = "mingi-tau-" + Math.random().toString(36).slice(2);
  return [
    `From: Mingi-Tau <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64wrap(plain),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64wrap(html),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

// Отправка письма по SMTP своими руками, без библиотек.
// Каждый шаг пишется в журнал; на всё — жёсткий таймаут.
async function sendViaYandex(
  to: string,
  subject: string,
  plain: string,
  html: string,
) {
  const user = Deno.env.get("YANDEX_SMTP_USER")!;
  const pass = Deno.env.get("YANDEX_SMTP_PASS")!;

  const work = (async () => {
    console.log("почтальон: соединяюсь с smtp.yandex.ru:465");
    const conn = await Deno.connectTls({
      hostname: "smtp.yandex.ru",
      port: 465,
    });
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    let buf = "";

    // Читаем ответ сервера до финальной строки вида "250 ..." (код+пробел)
    async function expect(codes: string[], step: string) {
      while (true) {
        const lines = buf.split("\r\n");
        for (const line of lines) {
          if (/^\d{3} /.test(line)) {
            const code = line.slice(0, 3);
            if (!codes.includes(code)) {
              throw new Error(
                `почта: шаг «${step}» ответ ${line.slice(0, 120)}`,
              );
            }
            console.log(`почтальон: ${step} → ${code}`);
            buf = "";
            return;
          }
        }
        const { value, done } = await reader.read();
        if (done)
          throw new Error(`почта: соединение оборвалось на шаге «${step}»`);
        buf += dec.decode(value);
      }
    }

    async function say(cmd: string, masked?: string) {
      console.log("почтальон: →", masked ?? cmd);
      await writer.write(enc.encode(cmd + "\r\n"));
    }

    try {
      await expect(["220"], "приветствие");
      await say("EHLO mingi-tau.ru");
      await expect(["250"], "EHLO");
      await say("AUTH LOGIN");
      await expect(["334"], "AUTH");
      await say(b64(user), "(логин)");
      await expect(["334"], "логин");
      await say(b64(pass), "(пароль)");
      await expect(["235"], "пароль принят");
      await say(`MAIL FROM:<${user}>`);
      await expect(["250"], "MAIL FROM");
      await say(`RCPT TO:<${to}>`);
      await expect(["250", "251"], "RCPT TO");
      await say("DATA");
      await expect(["354"], "DATA");
      const mime = buildMime(user, to, subject, plain, html);
      await writer.write(enc.encode(mime + "\r\n.\r\n"));
      await expect(["250"], "письмо принято");
      await say("QUIT");
      // ответ на QUIT не ждём — письмо уже принято
    } finally {
      try {
        reader.releaseLock();
      } catch (_) {
        /* уже закрыт */
      }
      try {
        writer.releaseLock();
      } catch (_) {
        /* уже закрыт */
      }
      try {
        conn.close();
      } catch (_) {
        /* уже закрыт */
      }
    }
  })();

  // Предохранитель: если Яндекс молчит — падаем с понятной ошибкой,
  // а не висим до принудительного убийства функции.
  let timer: number | undefined;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("почта: не уложились в таймаут")),
      SMTP_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([work, timeout]);
    console.log("почтальон: письмо отправлено на", to.slice(0, 3) + "…");
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Обработчик запросов ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, email, code } = await req.json();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return json({ error: "Некорректная почта" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "send") {
      // Защита от спама: не чаще одного письма в минуту
      const { data: recent } = await supabase
        .from("email_verification_codes")
        .select("created_at")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent) {
        const secondsAgo =
          (Date.now() - new Date(recent.created_at).getTime()) / 1000;
        if (secondsAgo < RESEND_COOLDOWN_SECONDS) {
          return json(
            {
              error: `Код уже отправлен. Повторная отправка через ${Math.ceil(
                RESEND_COOLDOWN_SECONDS - secondsAgo,
              )} сек.`,
            },
            429,
          );
        }
      }

      // Старые коды этой почты больше не действуют
      await supabase
        .from("email_verification_codes")
        .delete()
        .eq("email", normalizedEmail);

      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(
        Date.now() + CODE_TTL_MINUTES * 60 * 1000,
      ).toISOString();

      const { error: insertError } = await supabase
        .from("email_verification_codes")
        .insert({
          email: normalizedEmail,
          code: newCode,
          expires_at: expiresAt,
        });

      if (insertError) {
        return json({ error: "Не удалось создать код" }, 500);
      }

      try {
        await sendViaYandex(
          normalizedEmail,
          `Mingi-Tau: code ${newCode}`,
          [
            `Ваш код подтверждения: ${newCode}`,
            "",
            `Код действует ${CODE_TTL_MINUTES} минут.`,
            "Если вы не регистрировались в «Минги-Тау», просто удалите это письмо.",
          ].join("\n"),
          buildHtml(newCode),
        );
      } catch (mailError) {
        console.error("почтальон: отправка не удалась:", mailError);
        return json(
          { error: "Письмо не отправилось. Попробуйте ещё раз через минуту." },
          502,
        );
      }

      return json({ sent: true });
    }

    if (action === "verify") {
      const inputCode = String(code || "").trim();

      if (!inputCode) {
        return json({ error: "Введите код" }, 400);
      }

      const { data: row } = await supabase
        .from("email_verification_codes")
        .select("*")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) {
        return json({ error: "Код не найден. Запросите новый." }, 400);
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "Код истёк. Запросите новый." }, 400);
      }

      if (row.attempts >= MAX_ATTEMPTS) {
        return json(
          { error: "Слишком много попыток. Запросите новый код." },
          429,
        );
      }

      if (row.code !== inputCode) {
        await supabase
          .from("email_verification_codes")
          .update({ attempts: row.attempts + 1 })
          .eq("id", row.id);

        return json({ error: "Неверный код" }, 400);
      }

      await supabase
        .from("email_verification_codes")
        .update({ verified: true })
        .eq("id", row.id);

      return json({ verified: true });
    }

    return json({ error: "Неизвестное действие" }, 400);
  } catch (e) {
    console.error("send-email-code error:", e);
    return json({ error: "Внутренняя ошибка почтальона" }, 500);
  }
});
