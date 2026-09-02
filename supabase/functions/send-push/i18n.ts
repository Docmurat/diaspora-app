// СЕРВЕРНАЯ копия перевода уведомлений (Веха 65, пуши).
// СГЕНЕРИРОВАНО из services/translations.ts и services/notificationI18n.ts
// приложения — логика и словарь ntf.* совпадают буква в букву.
// ВАЖНО: при изменении текстов уведомлений или ключей ntf.* править
// нужно ДВА места — приложение и этот файл (правило в CLAUDE.md).
// Модераторские уведомления сюда не попадают: почтальон шлёт их по-русски.

export type Lang = "ru" | "en" | "kb";

type Entry = { ru: string; en: string | null; kb: string | null };

const STRINGS: Record<string, Entry> = {
  "chat.attach.photo": { ru: "Фото", en: "Photo", kb: "Сурат" },
  "ntf.invite.title": { ru: "Новый участник по вашему инвайту", en: "New member via your invite", kb: "Сизни чакъырыуугъуз бла джангы адам" },
  "ntf.invite.body": { ru: "{имя} присоединился к сообществу по вашему приглашению.", en: "{имя} has joined the community via your invitation.", kb: "{имя} сизни чакъырыуугъуз бла сообществогъа къошулду." },
  "ntf.fallback.newMember": { ru: "Новый участник", en: "New member", kb: "Джангы адам" },
  "ntf.appeal.closed": { ru: "Обращение закрыто", en: "Request closed", kb: "Тилек джабылды" },
  "ntf.appeal.closedBody": { ru: "Ваше обращение рассмотрено администрацией.", en: "Your request has been reviewed by the administration.", kb: "Тилегигизге администрация къарагъанды." },
  "ntf.appeal.reply": { ru: "Ответ администрации", en: "Reply from the administration", kb: "Администрацияны джууабы" },
  "ntf.help.comment": { ru: "Новый комментарий к вашему посту", en: "New comment on your post", kb: "Постугъузгъа джангы комментарий" },
  "ntf.help.reply": { ru: "Ответ на ваш комментарий", en: "Reply to your comment", kb: "Комментарийигизге джууаб" },
  "ntf.help.newPost": { ru: "Новый пост на Стене помощи · {сфера}", en: "New post on the Help Wall · {сфера}", kb: "Болушлукъ стенада джангы пост · {сфера}" },
  "ntf.help.blocked": { ru: "Пост скрыт модерацией", en: "Post hidden by moderation", kb: "Пост модерация бла джашырылгъанды" },
  "ntf.help.blockedBody": { ru: "Ваш пост на Стене помощи заблокирован и виден только вам.", en: "Your post on the Help Wall has been blocked and is visible only to you.", kb: "Болушлукъ стенадагъы постугъуз блок этилгенди эмда джангыз сизге кёрюнеди." },
  "ntf.help.blockedReason": { ru: "Причина: {причина}", en: "Reason: {причина}", kb: "Себеб: {причина}" },
  "ntf.complaint.resolved": { ru: "Жалоба на {имя} рассмотрена", en: "Your report on {имя} has been reviewed", kb: "{имя} юсюнден тарыгъыугъа къаралды" },
  "ntf.complaint.resolvedBody": { ru: "Мы разобрались и приняли меры. Спасибо, что помогаете беречь сообщество.", en: "We have looked into it and taken action. Thank you for helping to protect the community.", kb: "Биз тинтдик эмда мадар этдик. Джамагъатны сакълагъаныгъыз ючюн сау болугъуз." },
  "ntf.complaint.rejected": { ru: "Жалоба на {имя} отклонена", en: "Your report on {имя} has been declined", kb: "{имя} юсюнден тарыгъыу алынмады" },
  "ntf.complaint.rejectedBody": { ru: "Мы изучили обращение и не нашли нарушений правил сообщества.", en: "We have reviewed the report and found no violation of the community rules.", kb: "Биз тарыгъыугъа къарадыкъ эмда сообществону джорукъларын бузгъан зат табмадыкъ." },
  "ntf.fallback.member": { ru: "участника", en: "a member", kb: "адамны" },
  "ntf.nameChange.approved": { ru: "Имя изменено", en: "Name changed", kb: "Ат тюрлендирилди" },
  "ntf.nameChange.approvedBody": { ru: "Заявка одобрена. Теперь вас зовут {имя}.", en: "Request approved. Your name is now {имя}.", kb: "Заявка алынды. Энди атыгъыз — {имя}." },
  "ntf.nameChange.rejected": { ru: "Заявка на смену имени отклонена", en: "Name change request declined", kb: "Ат тюрлендириу заявка алынмады" },
  "ntf.nameChange.rejectedBody": { ru: "Имя осталось прежним.", en: "Your name remains unchanged.", kb: "Ат алгъынча къалды." },
  "ntf.nameChange.note": { ru: "Комментарий модератора: «{текст}»", en: "Moderator’s comment: “{текст}”", kb: "Модераторну комментарийи: «{текст}»" },
  "ntf.message.title": { ru: "Новое сообщение: {имя}", en: "New message: {имя}", kb: "Джангы письмо: {имя}" },
  "ntf.fallback.participant": { ru: "Участник", en: "Member", kb: "Адам" },
  "ntf.reg.approved": { ru: "Заявка одобрена", en: "Application approved", kb: "Заявка алынды" },
  "ntf.reg.approvedBody": { ru: "Добро пожаловать в «Минги-Тау». Теперь вам доступно всё сообщество.", en: "Welcome to Mingi-Tau. The whole community is now open to you.", kb: "«Минги-Тау»-гъа хош келигиз. Энди сизге бютеу сообщество ачыкъды." },
  "ntf.reg.revision": { ru: "Анкету нужно исправить", en: "Your profile needs corrections", kb: "Анкетаны тюзетирге керекди" },
  "ntf.reg.rejected": { ru: "Заявка отклонена", en: "Application declined", kb: "Заявка алынмады" },
  "ntf.qual.confirmed": { ru: "Квалификация подтверждена", en: "Qualification confirmed", kb: "Квалификация бегитилгенди" },
  "ntf.qual.confirmedBody": { ru: "Ваша квалификация в категории «{сфера}» подтверждена. На Стене помощи вам доступны скрытые материалы и обсуждения этой категории.", en: "Your qualification in the “{сфера}” category has been confirmed. Hidden materials and discussions of this category on the Help Wall are now available to you.", kb: "«{сфера}» категорияда квалификациягъыз бегитилгенди. Болушлукъ стенада бу категорияны джашырылгъан материаллары бла ушакълары энди сизге ачыкъдыла." },
};

const CATEGORY_LABELS: Record<string, { en: string | null; kb: string | null }> = {
  "Медицина": { en: "Medicine", kb: "Медицина" },
  "Юриспруденция": { en: "Law", kb: "Юриспруденция" },
  "Образование": { en: "Education", kb: "Билим бериу" },
  "IT и технологии": { en: "IT & Technology", kb: "IT эмда технологияла" },
  "Бизнес и финансы": { en: "Business & Finance", kb: "Бизнес эмда финансла" },
  "Строительство и недвижимость": { en: "Construction & Real Estate", kb: "Мекям ишлеучу эмда джюрюмеген мюлк" },
  "Логистика и транспорт": { en: "Logistics & Transport", kb: "Логистика эмда транспорт" },
  "Услуги и сервис": { en: "Services", kb: "Хатерлик эмда сервис" },
  "Маркетинг и медиа": { en: "Marketing & Media", kb: "Маркетинг эмда медиа" },
  "Дизайн и творчество": { en: "Design & Arts", kb: "Дизайн эмда чыгъармачылыкъ" },
  "Государственная служба": { en: "Public Service", kb: "Кърал къуллукъ" },
  "Наука и исследования": { en: "Science & Research", kb: "Илму эмда тинтиуле" },
  "Спорт и здоровье": { en: "Sports & Health", kb: "Спорт эмда саулукъ" },
  "Дом и быт": { en: "Home & Household", kb: "Юй эмда турмуш" },
  "Другое": { en: "Other", kb: "Башха" },
};
function t(
  lang: Lang,
  key: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  const entry = STRINGS[key];
  let text: string;
  if (!entry) {
    text = key;
  } else if (lang === "en") {
    text = entry.en ?? entry.ru;
  } else if (lang === "kb") {
    text = entry.kb ?? entry.ru;
  } else {
    text = entry.ru;
  }

  if (params) {
    for (const name of Object.keys(params)) {
      const value = params[name];
      text = text
        .split(`{${name}}`)
        .join(value === null || value === undefined ? "" : String(value));
    }
  }
  return text;
}

function tCategory(lang: Lang, ruValue: string): string {
  const entry = CATEGORY_LABELS[ruValue];
  if (!entry) return ruValue;
  if (lang === "en") return entry.en ?? ruValue;
  if (lang === "kb") return entry.kb ?? ruValue;
  return ruValue;
}

const EXACT_BODIES: Record<string, string> = {
  "Ваше обращение рассмотрено администрацией.": "ntf.appeal.closedBody",
  "Мы разобрались и приняли меры. Спасибо, что помогаете беречь сообщество.":
    "ntf.complaint.resolvedBody",
  "Мы изучили обращение и не нашли нарушений правил сообщества.":
    "ntf.complaint.rejectedBody",
  "Добро пожаловать в «Минги-Тау». Теперь вам доступно всё сообщество.":
    "ntf.reg.approvedBody",
};

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

function localizeTitle(lang: Lang, title: string): string {
  const exact = EXACT_TITLES[title];
  if (exact) return t(lang, exact);

  let m: RegExpMatchArray | null;

  m = title.match(/^Новый пост на Стене помощи · (.+)$/);
  if (m) return t(lang, "ntf.help.newPost", { сфера: tCategory(lang, m[1]) });

  m = title.match(/^Жалоба на (.+) рассмотрена$/);
  if (m) {
    const name = m[1] === "участника" ? t(lang, "ntf.fallback.member") : m[1];
    return t(lang, "ntf.complaint.resolved", { имя: name });
  }

  m = title.match(/^Жалоба на (.+) отклонена$/);
  if (m) {
    const name = m[1] === "участника" ? t(lang, "ntf.fallback.member") : m[1];
    return t(lang, "ntf.complaint.rejected", { имя: name });
  }

  m = title.match(/^Новое сообщение: (.+)$/);
  if (m) {
    const name =
      m[1] === "Участник" ? t(lang, "ntf.fallback.participant") : m[1];
    return t(lang, "ntf.message.title", { имя: name });
  }

  return title;
}

function localizeBody(
  lang: Lang,
  title: string,
  body: string | null,
): string | null {
  if (!body) return body;

  const exact = EXACT_BODIES[body];
  if (exact) return t(lang, exact);

  let m: RegExpMatchArray | null;

  m = body.match(/^(.+) присоединился к сообществу по вашему приглашению\.$/);
  if (m) {
    const name =
      m[1] === "Новый участник" ? t(lang, "ntf.fallback.newMember") : m[1];
    return t(lang, "ntf.invite.body", { имя: name });
  }

  m = body.match(
    /^Ваш пост на Стене помощи заблокирован и виден только вам\.(?: Причина: ([\s\S]+))?$/,
  );
  if (m) {
    const base = t(lang, "ntf.help.blockedBody");
    return m[1]
      ? `${base} ${t(lang, "ntf.help.blockedReason", { причина: m[1] })}`
      : base;
  }

  m = body.match(/^Заявка одобрена\. Теперь вас зовут (.+)\.$/);
  if (m) return t(lang, "ntf.nameChange.approvedBody", { имя: m[1] });

  m = body.match(
    /^Имя осталось прежним\.(?: Комментарий модератора: «([\s\S]+)»)?$/,
  );
  if (m) {
    const base = t(lang, "ntf.nameChange.rejectedBody");
    return m[1]
      ? `${base} ${t(lang, "ntf.nameChange.note", { текст: m[1] })}`
      : base;
  }

  m = body.match(
    /^Ваша квалификация в категории «(.+)» подтверждена\. На Стене помощи вам доступны скрытые материалы и обсуждения этой категории\.$/,
  );
  if (m) return t(lang, "ntf.qual.confirmedBody", { сфера: tCategory(lang, m[1]) });

  if (title.startsWith("Новое сообщение:") && body === "📷 Фото") {
    return `📷 ${t(lang, "chat.attach.photo")}`;
  }

  return body;
}

export function localizeNotification(
  n: { title: string; body: string | null },
  lang: Lang,
): { title: string; body: string | null } {
  if (lang === "ru") return { title: n.title, body: n.body };

  return {
    title: localizeTitle(lang, n.title),
    body: localizeBody(lang, n.title, n.body),
  };
}
