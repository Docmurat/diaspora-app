// Чистильщик контактов (Веха 62): ники Telegram/Instagram и номер для
// WhatsApp. Одно правило в одном месте — в базе храним чистое имя без
// «@» и ссылок, а все экраны показывают его одинаково.

const LINK_PREFIX =
  /^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/|instagram\.com\/)/i;

// «@doc_murat», «doc_murat», «https://instagram.com/doc_murat/» →
// «doc_murat». Явную белиберду (с пробелами) не трогаем — сохраняем
// как ввели (решение владельца).
export function normalizeHandle(raw?: string | null): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const withoutLink = trimmed.replace(LINK_PREFIX, "");
  const username = withoutLink
    .replace(/^@+/, "")
    .replace(/[/?#].*$/, "")
    .trim();

  if (!username || /\s/.test(username)) return trimmed;

  return username;
}

// Показ в анкетах: чистое имя — с собакой («@doc_murat»),
// всё остальное — как есть.
export function formatHandle(value?: string | null): string {
  const v = (value || "").trim();
  if (!v) return "";
  return /^[A-Za-z0-9._]+$/.test(v) ? `@${v}` : v;
}

// Номер для wa.me: только цифры в международном виде.
// «8 928 123-45-67» → «79281234567»; «+7 (928) …» → «7928…»;
// «00 49 …» (европейская запись) → «49…».
export function whatsappDigits(phone?: string | null): string {
  let digits = (phone || "").replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Российская домашняя запись с восьмёркой → международная с семёркой
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  return digits;
}

// Чистка номера при сохранении: в базе — строго «+79281234567»,
// как бы человек ни записал («8 928…», «+7 (928)…», «0049…»).
// Не похожее на номер — сохраняем как ввели (решение владельца).
export function normalizePhone(raw?: string | null): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const digits = whatsappDigits(trimmed);

  if (digits.length < 10 || digits.length > 15) return trimmed;

  return "+" + digits;
}

// Единый показ номера в анкетах: российские — «+7 928 123-45-67»,
// зарубежные — «+90 5321112233», не-номера — как есть.
export function formatPhone(value?: string | null): string {
  const v = (value || "").trim();
  if (!v) return "";

  const digits = whatsappDigits(v);

  if (digits.length === 11 && digits.startsWith("7")) {
    return (
      "+7 " +
      digits.slice(1, 4) +
      " " +
      digits.slice(4, 7) +
      "-" +
      digits.slice(7, 9) +
      "-" +
      digits.slice(9, 11)
    );
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return "+" + digits.slice(0, 2) + " " + digits.slice(2);
  }

  return v;
}
