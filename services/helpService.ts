// Стена помощи: все разговоры с базой в одном месте (Веха 52).
// Экраны знают только функции отсюда — при переменах на сервере
// переписывается этот файл.

import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────
// Категории. Источник истины — список categories в app/register.tsx:
// при изменении там НЕ ЗАБЫТЬ поправить здесь (и наоборот).
export const HELP_CATEGORIES = [
  "Медицина",
  "Юриспруденция",
  "Образование",
  "IT и технологии",
  "Бизнес и финансы",
  "Строительство и недвижимость",
  "Логистика и транспорт",
  "Услуги и сервис",
  "Маркетинг и медиа",
  "Дизайн и творчество",
  "Государственная служба",
  "Наука и исследования",
  "Спорт и здоровье",
  "Дом и быт",
  "Другое",
];

// Чувствительные категории: только в них есть скрытый блок
// (решение владельца, 14.08.2026). Расширять — просто дописать сюда.
export const SENSITIVE_CATEGORIES = ["Медицина", "Юриспруденция"];

// Тип поста: в базе по-английски, на экране по-русски.
export type HelpPostType = "question" | "offer";

export const POST_TYPE_LABELS: Record<HelpPostType, string> = {
  question: "Вопрос",
  offer: "Предложение",
};

export type HelpAuthor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  // Поля ниже нужны для профессии под именем и перехода на профиль
  // (экран user-profile принимает анкету параметрами — как в «Людях»).
  profession: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  birth_date: string | null;
  telegram: string | null;
  bio: string | null;
  extra_info: string | null;
};

// Поля автора одним списком — чтобы запросы в ленте и на экране поста
// не разъезжались.
const AUTHOR_FIELDS =
  "id, first_name, last_name, avatar_path, profession, category, " +
  "city, country, birth_date, telegram, bio, extra_info";

export type HelpFeedItem = {
  id: string;
  category: string;
  postType: HelpPostType;
  body: string;
  status: "active" | "archived" | "blocked";
  hasHidden: boolean;
  commentsHidden: boolean;
  createdAt: string;
  author: HelpAuthor | null;
  commentCount: number;
  photoCount: number; // открытые фото — для пометки в карточке
};

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error("Пользователь не авторизован");
  }

  return user.id;
}

// ─────────────────────────────────────────────────────────────────────
// ЛЕНТА. Фильтр по категориям применяется прямо в запросе.
// Пустой фильтр (null / []) = показывать все категории.

export async function getHelpFeed(
  filterCategories: string[] | null,
): Promise<HelpFeedItem[]> {
  // Лента: живые посты + закрытые за последние 3 дня (серые, с пометкой
  // «Завершено» — люди видят, что вопрос решился). Старше — только архив.
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let query = supabase
    .from("help_posts")
    .select(
      "id, author_id, category, post_type, body, status, has_hidden, " +
        "comments_hidden, created_at, archived_at",
    )
    .or(
      `status.eq.active,and(status.eq.archived,archived_at.gt.${threeDaysAgo})`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filterCategories && filterCategories.length > 0) {
    query = query.in("category", filterCategories);
  }

  const { data: posts, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  if (!posts || posts.length === 0) {
    return [];
  }

  const postIds = posts.map((p: any) => p.id);
  const authorIds = Array.from(new Set(posts.map((p: any) => p.author_id)));

  // Авторы — вторым запросом, как в chatService.
  const authorById = new Map<string, HelpAuthor>();
  try {
    const { data: authors } = await supabase
      .from("users")
      .select(AUTHOR_FIELDS)
      .in("id", authorIds);

    for (const a of authors || []) {
      authorById.set(a.id, a as HelpAuthor);
    }
  } catch {
    // анкета может быть скрыта правилами — карточка выживет без автора
  }

  // Счётчик комментариев и пометка «есть фото» — украшения:
  // при ошибке лента живёт без них.
  const commentCountByPost = new Map<string, number>();
  try {
    const { data: comments } = await supabase
      .from("help_comments")
      .select("post_id")
      .in("post_id", postIds);

    for (const c of comments || []) {
      commentCountByPost.set(
        c.post_id,
        (commentCountByPost.get(c.post_id) || 0) + 1,
      );
    }
  } catch {}

  const photoCountByPost = new Map<string, number>();
  try {
    const { data: attachments } = await supabase
      .from("help_attachments")
      .select("post_id, is_hidden, mime_type")
      .in("post_id", postIds)
      .eq("is_hidden", false);

    for (const a of attachments || []) {
      if ((a.mime_type || "").startsWith("image/")) {
        photoCountByPost.set(
          a.post_id,
          (photoCountByPost.get(a.post_id) || 0) + 1,
        );
      }
    }
  } catch {}

  return posts.map((p: any) => ({
    id: p.id,
    category: p.category,
    postType: p.post_type as HelpPostType,
    body: p.body,
    status: p.status,
    hasHidden: !!p.has_hidden,
    commentsHidden: !!p.comments_hidden,
    createdAt: p.created_at,
    author: authorById.get(p.author_id) || null,
    commentCount: commentCountByPost.get(p.id) || 0,
    photoCount: photoCountByPost.get(p.id) || 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// ФИЛЬТР И ТОЧКА. Настройки лежат в своей строке users:
// help_filter_categories (null/[] = все), help_seen_at (последний
// заход на вкладку — для точки в MingiTabBar).

export async function getMyHelpSettings(): Promise<{
  filterCategories: string[];
  notifyNewPosts: boolean;
}> {
  const myUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("users")
    .select("help_filter_categories, help_notify_new_posts")
    .eq("id", myUserId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    filterCategories: data?.help_filter_categories || [],
    notifyNewPosts: data?.help_notify_new_posts !== false,
  };
}

export async function saveMyHelpFilter(
  filterCategories: string[],
): Promise<void> {
  const myUserId = await getCurrentUserId();

  const { error } = await supabase
    .from("users")
    .update({
      help_filter_categories:
        filterCategories.length > 0 ? filterCategories : null,
    })
    .eq("id", myUserId);

  if (error) {
    throw new Error(error.message);
  }
}

// Открыл вкладку «Помощь» — точка гаснет.
export async function markHelpSeen(): Promise<void> {
  try {
    const myUserId = await getCurrentUserId();

    await supabase
      .from("users")
      .update({ help_seen_at: new Date().toISOString() })
      .eq("id", myUserId);
  } catch {
    // точка — украшение, ошибку молчим
  }
}

// Есть ли живые посты по моему фильтру новее моего последнего захода —
// для точки на вкладке. При любой ошибке тихо «нет».
export async function hasUnseenHelpPosts(): Promise<boolean> {
  try {
    const myUserId = await getCurrentUserId();

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("help_seen_at, help_filter_categories")
      .eq("id", myUserId)
      .single();

    if (meError) return false;

    let query = supabase
      .from("help_posts")
      .select("id")
      .eq("status", "active")
      .neq("author_id", myUserId)
      .limit(1);

    if (me?.help_seen_at) {
      query = query.gt("created_at", me.help_seen_at);
    }

    const filter = me?.help_filter_categories || [];
    if (filter.length > 0) {
      query = query.in("category", filter);
    }

    const { data, error } = await query;

    if (error) return false;

    return (data || []).length > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// СОЗДАНИЕ ПОСТА. Порядок: пост → скрытый текст → файлы.
// Файлы лежат в закрытой полке help-attachments по пути
// postId/open/имя или postId/hidden/имя — вторая папка говорит
// правилам хранилища, скрытый файл или открытый.

export type NewHelpFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
  isHidden: boolean;
};

export async function createHelpPost(input: {
  category: string;
  postType: HelpPostType;
  body: string;
  hiddenBody: string;
  commentsHidden: boolean;
  files: NewHelpFile[];
}): Promise<{ postId: string; failedFiles: string[] }> {
  const myUserId = await getCurrentUserId();

  const hiddenText = input.hiddenBody.trim();
  const hasHiddenFiles = input.files.some((f) => f.isHidden);
  const hasHidden = !!hiddenText || hasHiddenFiles;

  const { data: post, error: postError } = await supabase
    .from("help_posts")
    .insert({
      author_id: myUserId,
      category: input.category,
      post_type: input.postType,
      body: input.body.trim(),
      status: "active",
      has_hidden: hasHidden,
      comments_hidden: input.commentsHidden,
    })
    .select("id")
    .single();

  if (postError || !post?.id) {
    throw new Error(postError?.message || "Не удалось создать пост");
  }

  const postId = post.id as string;

  if (hiddenText) {
    const { error: hiddenError } = await supabase
      .from("help_post_hidden")
      .insert({ post_id: postId, body: hiddenText });

    if (hiddenError) {
      console.log("Скрытый текст не сохранился:", hiddenError.message);
    }
  }

  // Файлы: пост уже создан, поэтому ошибки загрузки не валят публикацию —
  // собираем имена неудачников и сообщаем автору.
  const failedFiles: string[] = [];

  for (const file of input.files) {
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const folder = file.isHidden ? "hidden" : "open";
      const storagePath = `${postId}/${folder}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("help-attachments")
        .upload(storagePath, blob, {
          contentType: file.mimeType || "application/octet-stream",
        });

      if (uploadError) {
        failedFiles.push(file.name);
        continue;
      }

      const { error: rowError } = await supabase
        .from("help_attachments")
        .insert({
          post_id: postId,
          author_id: myUserId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.mimeType || null,
          file_size: file.size,
          is_hidden: file.isHidden,
        });

      if (rowError) {
        failedFiles.push(file.name);
      }
    } catch {
      failedFiles.push(file.name);
    }
  }

  return { postId, failedFiles };
}

// ─────────────────────────────────────────────────────────────────────
// ОДИН ПОСТ (для экрана /help-post). Скрытую часть просто спрашиваем:
// правила базы сами отдают её только тем, кому положено. Пусто при
// has_hidden=true = у меня нет допуска → экран покажет плашку.

export type HelpAttachmentItem = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  isHidden: boolean;
  signedUrl: string | null;
};

export type HelpPostDetails = {
  id: string;
  category: string;
  postType: HelpPostType;
  body: string;
  status: "active" | "archived" | "blocked";
  hasHidden: boolean;
  commentsHidden: boolean;
  createdAt: string;
  author: HelpAuthor | null;
  isMine: boolean;
  hiddenBody: string | null; // null = нет допуска или нет текста
  hiddenVisible: boolean; // достал ли я хоть что-то скрытое
  attachments: HelpAttachmentItem[];
};

// Параметры для экрана /user-profile — тот же набор, что в «Людях»
// (экран профиля получает анкету параметрами, не запросом).
export function authorProfileParams(author: HelpAuthor) {
  const fullName =
    `${author.first_name || ""} ${author.last_name || ""}`.trim() ||
    "Участник";

  return {
    id: author.id,
    name: fullName,
    category: author.category || "",
    profession: author.profession || "",
    city: author.city || "",
    country: author.country || "",
    birthDate: author.birth_date || "",
    telegram: author.telegram || "",
    bio: author.bio || "",
    extraInfo: author.extra_info || "",
    avatarUri: author.avatar_path || "",
  };
}

export async function getHelpPost(postId: string): Promise<HelpPostDetails> {
  const myUserId = await getCurrentUserId();

  const { data: post, error } = await supabase
    .from("help_posts")
    .select(
      "id, author_id, category, post_type, body, status, has_hidden, " +
        "comments_hidden, created_at",
    )
    .eq("id", postId)
    .single();

  if (error || !post) {
    throw new Error(error?.message || "Пост не найден");
  }

  let author: HelpAuthor | null = null;
  try {
    const { data: authorRow } = await supabase
      .from("users")
      .select(AUTHOR_FIELDS)
      .eq("id", post.author_id)
      .single();

    author = (authorRow as HelpAuthor) || null;
  } catch {}

  // Скрытый текст: строка придёт только при допуске.
  let hiddenBody: string | null = null;
  try {
    const { data: hiddenRow } = await supabase
      .from("help_post_hidden")
      .select("body")
      .eq("post_id", postId)
      .maybeSingle();

    hiddenBody = hiddenRow?.body || null;
  } catch {}

  // Вложения: скрытые тоже придут только при допуске.
  const attachments: HelpAttachmentItem[] = [];
  let sawHiddenAttachment = false;

  try {
    const { data: rows } = await supabase
      .from("help_attachments")
      .select("id, storage_path, file_name, mime_type, is_hidden")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    for (const row of rows || []) {
      if (row.is_hidden) sawHiddenAttachment = true;

      let signedUrl: string | null = null;
      try {
        const { data: signed } = await supabase.storage
          .from("help-attachments")
          .createSignedUrl(row.storage_path, 3600);

        signedUrl = signed?.signedUrl || null;
      } catch {}

      attachments.push({
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        isHidden: !!row.is_hidden,
        signedUrl,
      });
    }
  } catch {}

  return {
    id: post.id,
    category: post.category,
    postType: post.post_type as HelpPostType,
    body: post.body,
    status: post.status,
    hasHidden: !!post.has_hidden,
    commentsHidden: !!post.comments_hidden,
    createdAt: post.created_at,
    author,
    isMine: post.author_id === myUserId,
    hiddenBody,
    hiddenVisible: !!hiddenBody || sawHiddenAttachment,
    attachments,
  };
}
