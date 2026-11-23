// Ресурсы (Веха 71) — список полезных сервисов во вкладке «Знания».
// Таблица public.resources: читают все участники, ведут основатель и
// модераторы (правила стоят на сервере — файл supabase/sql/
// veha71-resources.sql). У карточки может быть картинка — полка
// «resources» в хранилище, те же правила.
//
// Предложение ресурса от участника идёт ГОТОВЫМ конвейером «Обращения»
// (sendAppealMessage): карточка появляется в модерации в «Новом»,
// основатель и модераторы получают уведомление и пуш прежним триггером
// trg_appeal_message, ответ приходит участнику в колокольчик, переписка
// видна на экране «Связаться с администрацией». Ничего нового в базе
// для этого не заводилось.

import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { supabase } from "../lib/supabase";
import { sendAppealMessage } from "./moderationService";
import { getMyProfile } from "./profileService";

export type ResourceItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  // Полный адрес картинки на полке «resources»; null — без картинки.
  image_url: string | null;
};

const BUCKET = "resources";
const FIELDS = "id, title, description, url, image_url";

export const RESOURCE_TITLE_MAX = 80;
export const RESOURCE_DESCRIPTION_MAX = 600;

// Памятка на время работы приложения: при переключении пилюль и
// возврате на вкладку список виден сразу, сервер обновляет его поверх.
let resourcesCache: ResourceItem[] | null = null;

export function getCachedResources(): ResourceItem[] | null {
  return resourcesCache;
}

// «site.ru» → «https://site.ru». Пусто или не похоже на адрес — null.
export function normalizeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;

  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;

  // После схемы должен идти домен с точкой: «https://abc» не годится.
  if (!/^https?:\/\/[^/?#]+\.[^/?#]{2,}/i.test(withScheme)) return null;

  return withScheme;
}

// Короткий вид адреса для карточки: без схемы, www и хвостового «/».
export function prettyUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

export async function getResources(): Promise<ResourceItem[]> {
  const { data, error } = await supabase
    .from("resources")
    .select(FIELDS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  resourcesCache = (data || []) as ResourceItem[];
  return resourcesCache;
}

export async function getResource(id: string): Promise<ResourceItem | null> {
  const { data, error } = await supabase
    .from("resources")
    .select(FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data as ResourceItem) || null;
}

// Вести список могут основатель и модераторы. Проверка здесь — для
// экрана (показать ли кнопки); настоящий замок стоит на сервере.
export async function canManageResources(): Promise<boolean> {
  try {
    const me = await getMyProfile();
    return me?.role === "owner" || me?.role === "moderator";
  } catch {
    return false;
  }
}

// ── Картинка карточки ────────────────────────────────────────────────
// Квадрат 512×512 или широкая 900×300 JPEG из окна кадрирования
// (components/AvatarCrop).
// Лежит на открытой полке «resources»; в таблице — полный адрес, как
// avatar_path у анкет.

export function isLocalImage(uri?: string | null): boolean {
  return !!uri && !/^https?:\/\//i.test(uri);
}

// Широкая картинка (3:1, для горизонтальных логотипов) помечается
// хвостом «-w» в имени файла — отдельного поля в базе нет: форма
// картинки — свойство самого файла.
export function isWideImage(uri?: string | null): boolean {
  return !!uri && /-w\.jpg(\?|$)/i.test(uri);
}

async function uploadResourceImage(
  localUri: string,
  wide: boolean,
): Promise<string> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = `${stamp}${wide ? "-w" : ""}.jpg`;

  // Сайт отдаёт файл куском данных, телефон — через чтение с диска
  // (тот же приём, что у аватаров в storageService).
  const body =
    Platform.OS === "web"
      ? await (await fetch(localUri)).blob()
      : decode(
          await FileSystem.readAsStringAsync(localUri, {
            encoding: "base64" as any,
          }),
        );

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, body, { contentType: "image/jpeg", upsert: false });

  if (error) throw new Error(error.message);

  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
}

// Убрать файл с полки. Никогда не роняет основное действие: не вышло —
// файл просто останется лежать, карточке это не мешает.
async function removeResourceImage(imageUrl?: string | null): Promise<void> {
  try {
    if (!imageUrl) return;
    const marker = `/${BUCKET}/`;
    const at = imageUrl.lastIndexOf(marker);
    if (at < 0) return;
    const filePath = imageUrl.slice(at + marker.length).split("?")[0];
    if (!filePath) return;
    await supabase.storage.from(BUCKET).remove([filePath]);
  } catch (e) {
    console.log("Не удалось убрать картинку ресурса:", e);
  }
}

// image: адрес с полки (оставить как есть), локальный файл после
// кадрирования (загрузить) или пусто (без картинки).
type ResourceInput = {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  imageWide?: boolean; // форма НОВОЙ картинки (для уже сохранённой не нужна)
};

function checkInput(input: ResourceInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const url = normalizeUrl(input.url);

  if (!title || !description) throw new Error("Заполните название и описание");
  if (!url) throw new Error("Проверьте ссылку: нужен адрес сайта");

  return {
    title: title.slice(0, RESOURCE_TITLE_MAX),
    description: description.slice(0, RESOURCE_DESCRIPTION_MAX),
    url,
  };
}

export async function createResource(input: ResourceInput): Promise<void> {
  const row = checkInput(input);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const imageUrl = isLocalImage(input.image)
    ? await uploadResourceImage(input.image as string, !!input.imageWide)
    : null;

  const { error } = await supabase
    .from("resources")
    .insert({ ...row, image_url: imageUrl, created_by: user?.id ?? null });

  if (error) {
    // Карточка не создалась — только что загруженный файл не бросаем.
    await removeResourceImage(imageUrl);
    throw new Error(error.message);
  }
  resourcesCache = null;
}

export async function updateResource(
  id: string,
  input: ResourceInput,
): Promise<void> {
  const row = checkInput(input);

  const before = await getResource(id);
  const oldImage = before?.image_url ?? null;

  // Новая картинка — загружаем; прежняя — оставляем; пусто — убираем.
  const picked = input.image || null;
  const uploaded = isLocalImage(picked)
    ? await uploadResourceImage(picked as string, !!input.imageWide)
    : null;
  const imageUrl = uploaded || picked;

  // .select() — чтобы увидеть, принял ли сервер правку: при отказе
  // правил база молча меняет 0 строк и ошибки не даёт.
  const { data, error } = await supabase
    .from("resources")
    .update({
      ...row,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error || !data || data.length === 0) {
    await removeResourceImage(uploaded);
    throw new Error(
      error?.message || "Не удалось сохранить: база не приняла изменение",
    );
  }

  // Правка принята — старый файл больше не нужен.
  if (oldImage && oldImage !== imageUrl) await removeResourceImage(oldImage);
  resourcesCache = null;
}

export async function deleteResource(id: string): Promise<void> {
  const before = await getResource(id);

  const { data, error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Не удалось удалить: база не приняла изменение");
  }

  await removeResourceImage(before?.image_url);
  resourcesCache = null;
}

// Участник предлагает ресурс. Текст собирается ПО-РУССКИ на любом языке
// приложения: его читают основатель и модераторы (их раздел русский).
export async function suggestResource(input: {
  title: string;
  url: string;
  comment: string;
}): Promise<void> {
  const title = input.title.trim();
  const comment = input.comment.trim();
  const url = input.url.trim() ? normalizeUrl(input.url) : null;

  if (!title) throw new Error("Введите название ресурса");
  if (input.url.trim() && !url) {
    throw new Error("Проверьте ссылку: нужен адрес сайта");
  }

  const me = await getMyProfile();
  if (!me?.id) throw new Error("Профиль не найден");

  const lines = ["Предложение ресурса для раздела «Ресурсы».", ""];
  lines.push(`Название: ${title}`);
  if (url) lines.push(`Ссылка: ${url}`);
  if (comment) lines.push("", comment);

  await sendAppealMessage(me.id, lines.join("\n"));
}
