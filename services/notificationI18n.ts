// Перевод уведомлений (Веха 64.1).
//
// Тексты уведомлений рождаются ПО-РУССКИ — в триггерах базы и в коде
// (moderationService, messageService). База и триггеры не меняются:
// экран уведомлений узнаёт известные русские заголовки и типовые тела
// по шаблону, вытаскивает из них подстановки (имя, сферу, причину) и
// показывает перевод по ключам ntf.* из services/translations.ts.
//
// Что НЕ переводится (показывается как есть): тексты сообщений чата,
// комментарии, ответы и пояснения модераторов, а также все
// модераторские уведомления («Новая заявка», «Жалоба»…) — по решению
// владельца. Незнакомый текст всегда остаётся русским.
//
// Как пользоваться: const shown = localizeNotification(item);
// затем показывать shown.title / shown.body вместо item.title / item.body.

import { getLanguage, t, tCategory } from "./i18nService";

export type LocalizedNotification = { title: string; body: string | null };

// Тела-по-умолчанию: точное совпадение → ключ.
const EXACT_BODIES: Record<string, string> = {
  "Ваше обращение рассмотрено администрацией.": "ntf.appeal.closedBody",
  "Мы разобрались и приняли меры. Спасибо, что помогаете беречь сообщество.":
    "ntf.complaint.resolvedBody",
  "Мы изучили обращение и не нашли нарушений правил сообщества.":
    "ntf.complaint.rejectedBody",
  "Добро пожаловать в «Минги-Тау». Теперь вам доступно всё сообщество.":
    "ntf.reg.approvedBody",
};

// Заголовки без подстановок: точное совпадение → ключ.
const EXACT_TITLES: Record<string, string> = {
  "Новый участник по вашему инвайту": "ntf.invite.title",
  "Обращение закрыто": "ntf.appeal.closed",
  "Ответ администрации": "ntf.appeal.reply",
  "Новый комментарий к вашему посту": "ntf.help.comment",
  "Ответ на ваш комментарий": "ntf.help.reply",
  "Пост скрыт модерацией": "ntf.help.blocked",
  "Имя изменено": "ntf.nameChange.approved",
  "Заявка на смену имени отклонена": "ntf.nameChange.rejected",
  "Заявка одобрена": "ntf.reg.approved",
  "Анкету нужно исправить": "ntf.reg.revision",
  "Заявка отклонена": "ntf.reg.rejected",
  "Квалификация подтверждена": "ntf.qual.confirmed",
};

function localizeTitle(title: string): string {
  const exact = EXACT_TITLES[title];
  if (exact) return t(exact);

  let m: RegExpMatchArray | null;

  // «Новый пост на Стене помощи · Медицина»
  m = title.match(/^Новый пост на Стене помощи · (.+)$/);
  if (m) return t("ntf.help.newPost", { сфера: tCategory(m[1]) });

  // «Жалоба на Иван Иванов рассмотрена» / «…участника рассмотрена»
  m = title.match(/^Жалоба на (.+) рассмотрена$/);
  if (m) {
    const name = m[1] === "участника" ? t("ntf.fallback.member") : m[1];
    return t("ntf.complaint.resolved", { имя: name });
  }

  m = title.match(/^Жалоба на (.+) отклонена$/);
  if (m) {
    const name = m[1] === "участника" ? t("ntf.fallback.member") : m[1];
    return t("ntf.complaint.rejected", { имя: name });
  }

  // «Новое сообщение: Иван Иванов» / «…: Участник»
  m = title.match(/^Новое сообщение: (.+)$/);
  if (m) {
    const name = m[1] === "Участник" ? t("ntf.fallback.participant") : m[1];
    return t("ntf.message.title", { имя: name });
  }

  return title;
}

function localizeBody(title: string, body: string | null): string | null {
  if (!body) return body;

  const exact = EXACT_BODIES[body];
  if (exact) return t(exact);

  let m: RegExpMatchArray | null;

  // Инвайт: «Иван Иванов присоединился к сообществу по вашему приглашению.»
  m = body.match(/^(.+) присоединился к сообществу по вашему приглашению\.$/);
  if (m) {
    const name =
      m[1] === "Новый участник" ? t("ntf.fallback.newMember") : m[1];
    return t("ntf.invite.body", { имя: name });
  }

  // Пост скрыт: «…виден только вам.» + необязательно « Причина: …»
  m = body.match(
    /^Ваш пост на Стене помощи заблокирован и виден только вам\.(?: Причина: ([\s\S]+))?$/,
  );
  if (m) {
    const base = t("ntf.help.blockedBody");
    return m[1]
      ? `${base} ${t("ntf.help.blockedReason", { причина: m[1] })}`
      : base;
  }

  // Имя изменено: «Заявка одобрена. Теперь вас зовут Иван Иванов.»
  m = body.match(/^Заявка одобрена\. Теперь вас зовут (.+)\.$/);
  if (m) return t("ntf.nameChange.approvedBody", { имя: m[1] });

  // Смена имени отклонена: «Имя осталось прежним.» + необязательно
  // « Комментарий модератора: «…»»
  m = body.match(
    /^Имя осталось прежним\.(?: Комментарий модератора: «([\s\S]+)»)?$/,
  );
  if (m) {
    const base = t("ntf.nameChange.rejectedBody");
    return m[1]
      ? `${base} ${t("ntf.nameChange.note", { текст: m[1] })}`
      : base;
  }

  // Квалификация: «Ваша квалификация в категории «Медицина» подтверждена. …»
  m = body.match(
    /^Ваша квалификация в категории «(.+)» подтверждена\. На Стене помощи вам доступны скрытые материалы и обсуждения этой категории\.$/,
  );
  if (m) return t("ntf.qual.confirmedBody", { сфера: tCategory(m[1]) });

  // Чат: подпись фото-вложения «📷 Фото» (ключ уже есть в словаре чата)
  if (title.startsWith("Новое сообщение:") && body === "📷 Фото") {
    return `📷 ${t("chat.attach.photo")}`;
  }

  return body;
}

export function localizeNotification(n: {
  title: string;
  body: string | null;
}): LocalizedNotification {
  // Русский — язык оригинала: ничего не трогаем.
  if (getLanguage() === "ru") return { title: n.title, body: n.body };

  return {
    title: localizeTitle(n.title),
    body: localizeBody(n.title, n.body),
  };
}
