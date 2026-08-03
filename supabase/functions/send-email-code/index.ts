// Почтальон «Минги-Тау»: отправляет и проверяет коды подтверждения почты.
// Отправка — через ящик проекта на Яндексе (данные лежат в секретах).
// При переезде на Яндекс-серверы эта функция переедет без изменений логики.
// @ts-nocheck — файл для Deno (сервер), обычная проверка VS Code к нему не применима

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ВАЖНО: тема письма — только латиница.
// Кириллицу в заголовке библиотека кодирует так, что Яндекс показывает
// крякозябры. Русский текст живёт внутри письма (html/content) — там всё в порядке.

const CODE_TTL_MINUTES = 10; // сколько живёт код
const RESEND_COOLDOWN_SECONDS = 60; // пауза между отправками
const MAX_ATTEMPTS = 5; // попыток ввода кода

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
//вывы
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

      const smtpUser = Deno.env.get("YANDEX_SMTP_USER")!;
      const smtpPass = Deno.env.get("YANDEX_SMTP_PASS")!;

      const client = new SMTPClient({
        connection: {
          hostname: "smtp.yandex.ru",
          port: 465,
          tls: true,
          auth: { username: smtpUser, password: smtpPass },
        },
      });

      await client.send({
        from: `Mingi-Tau <${smtpUser}>`,
        to: normalizedEmail,
        subject: `Mingi-Tau: code ${newCode}`,
        content: [
          `Ваш код подтверждения: ${newCode}`,
          "",
          `Код действует ${CODE_TTL_MINUTES} минут.`,
          "Если вы не регистрировались в «Минги-Тау», просто удалите это письмо.",
        ].join("\n"),
        html: buildHtml(newCode),
      });

      await client.close();

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
