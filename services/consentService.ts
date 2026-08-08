// Журнал согласий (152-ФЗ, ч. 3 ст. 9): фиксирует, кто, когда и какую
// версию текста принял. Таблица public.consents неизменяемая — записи
// только добавляются и читаются, доказательство не редактируется.
//
// При обновлении текстов согласия или политики МЕНЯТЬ ВЕРСИИ здесь —
// в журнале останется след, какую редакцию принимал каждый человек.

import { supabase } from "../lib/supabase";

export const PDN_CONSENT_VERSION = "1.0 от 08.08.2026";
export const TERMS_VERSION = "2.0 от 15.08.2026";
export const MEMORANDUM_VERSION = "1.0 от 08.08.2026";

// Записывает все согласия нового участника (обработка ПДн + принятие
// соглашения и политики + Меморандум сообщества). Вызывается сразу
// после создания учётки.
// Регистрацию не роняет: если запись не удалась — след в консоли.
export async function recordRegistrationConsents(
  userId: string,
): Promise<void> {
  try {
    if (!userId) return;

    const { error } = await supabase.from("consents").insert([
      { user_id: userId, consent_type: "pdn", version: PDN_CONSENT_VERSION },
      { user_id: userId, consent_type: "terms", version: TERMS_VERSION },
      {
        user_id: userId,
        consent_type: "memorandum",
        version: MEMORANDUM_VERSION,
      },
    ]);

    if (error) {
      console.log("Журнал согласий: запись не удалась:", error.message);
    }
  } catch (e) {
    console.log("Журнал согласий: запись не удалась:", e);
  }
}
