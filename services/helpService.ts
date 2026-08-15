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
  thumbUrls: string[]; // до 3 миниатюр открытых фото (как в Threads)
  isMine: boolean; // мой пост — метки «новое» не получает
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
  const myUserId = await getCurrentUserId();
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
      const row = a as unknown as HelpAuthor;
      authorById.set(row.id, row);
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

  // Открытые фото: счётчик + миниатюры (до 3 на карточку). Ссылки
  // подписываем ОДНИМ пакетным запросом на всю ленту, чтобы не тормозить.
  const photoCountByPost = new Map<string, number>();
  const thumbUrlsByPost = new Map<string, string[]>();
  try {
    const { data: attachments } = await supabase
      .from("help_attachments")
      .select("post_id, is_hidden, mime_type, storage_path, created_at")
      .in("post_id", postIds)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true });

    const wanted: { postId: string; path: string }[] = [];

    for (const a of attachments || []) {
      if ((a.mime_type || "").startsWith("image/")) {
        const n = (photoCountByPost.get(a.post_id) || 0) + 1;
        photoCountByPost.set(a.post_id, n);
        if (n <= 3 && a.storage_path) {
          wanted.push({ postId: a.post_id, path: a.storage_path });
        }
      }
    }

    if (wanted.length > 0) {
      // Подписываем по одной (пакетная подпись на нашем хранилище
      // отвечает 500), но параллельно — лента не ждёт по очереди.
      const results = await Promise.all(
        wanted.map(async (w) => {
          try {
            const { data: signed } = await supabase.storage
              .from("help-attachments")
              .createSignedUrl(w.path, 3600);
            return { postId: w.postId, url: signed?.signedUrl || null };
          } catch {
            return { postId: w.postId, url: null };
          }
        }),
      );

      for (const r of results) {
        if (!r.url) continue;
        const urls = thumbUrlsByPost.get(r.postId) || [];
        urls.push(r.url);
        thumbUrlsByPost.set(r.postId, urls);
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
    isMine: p.author_id === myUserId,
    commentCount: commentCountByPost.get(p.id) || 0,
    photoCount: photoCountByPost.get(p.id) || 0,
    thumbUrls: thumbUrlsByPost.get(p.id) || [],
  }));
}

// ─────────────────────────────────────────────────────────────────────
// ФИЛЬТР, УВЕДОМЛЕНИЯ И ТОЧКА (Веха 54). Всё лежит в своей строке users.
// Три независимые вещи:
//  • help_filter_categories — фильтр ЛЕНТЫ. Просто фильтр, запоминается,
//    ни на что больше не влияет (null/[] = все).
//  • help_notify_categories — «какие посты мне важны» для точки и
//    колокольчика (null/[] = все категории).
//  • help_notify_new_posts — колокольчик: true — уведомлять о новых
//    постах важных категорий, false — тишина, но точка всё равно горит.
//  • help_seen_at — последний заход на вкладку (точка гаснет).
// Триггер notify_on_help_post в базе смотрит на два последних поля.

export type HelpSettings = {
  filterCategories: string[];
  notifyCategories: string[];
  notifyNewPosts: boolean;
};

export async function getMyHelpSettings(): Promise<HelpSettings> {
  const myUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("users")
    .select(
      "help_filter_categories, help_notify_categories, help_notify_new_posts",
    )
    .eq("id", myUserId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as any;
  return {
    filterCategories: row?.help_filter_categories || [],
    notifyCategories: row?.help_notify_categories || [],
    notifyNewPosts: row?.help_notify_new_posts !== false,
  };
}

// Фильтр ленты — только лента, ничего больше.
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

// Настройки уведомлений: важные категории ([] = все) и колокольчик.
export async function saveMyHelpNotifySettings(
  notifyCategories: string[],
  notifyNewPosts: boolean,
): Promise<void> {
  const myUserId = await getCurrentUserId();

  const { error } = await supabase
    .from("users")
    .update({
      help_notify_categories:
        notifyCategories.length > 0 ? notifyCategories : null,
      help_notify_new_posts: notifyNewPosts,
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

// Точка на вкладке: есть ли живые чужие посты ВАЖНЫХ категорий
// (help_notify_categories; пусто = все) новее моего последнего захода.
// Колокольчик на точку не влияет. При любой ошибке тихо «нет».
export async function hasUnseenHelpPosts(): Promise<boolean> {
  try {
    const myUserId = await getCurrentUserId();

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("help_seen_at, help_notify_categories")
      .eq("id", myUserId)
      .single();

    if (meError) return false;

    const my = me as any;

    let query = supabase
      .from("help_posts")
      .select("id")
      .eq("status", "active")
      .neq("author_id", myUserId)
      .limit(1);

    if (my?.help_seen_at) {
      query = query.gt("created_at", my.help_seen_at);
    }

    const important: string[] = my?.help_notify_categories || [];
    if (important.length > 0) {
      query = query.in("category", important);
    }

    const { data, error } = await query;

    if (error) return false;

    return (data || []).length > 0;
  } catch {
    return false;
  }
}

// Где именно новое (Веха 54): категории важных чужих живых постов новее
// моего последнего захода + сам момент захода. Экран ленты по этому
// подсвечивает карточки, кнопку фильтра и чипы, а точку на вкладке гасит
// ТОЛЬКО когда лента с текущим фильтром показала эти категории.
export type UnseenHelpInfo = {
  seenAt: string | null; // мой прошлый заход (посты новее — «новые»)
  categories: string[]; // где есть новое (пусто = нового нет)
};

export async function getUnseenHelpInfo(): Promise<UnseenHelpInfo> {
  try {
    const myUserId = await getCurrentUserId();

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("help_seen_at, help_notify_categories")
      .eq("id", myUserId)
      .single();

    if (meError) return { seenAt: null, categories: [] };

    const my = me as any;
    const seenAt: string | null = my?.help_seen_at || null;

    let query = supabase
      .from("help_posts")
      .select("category")
      .eq("status", "active")
      .neq("author_id", myUserId)
      .limit(200);

    if (seenAt) {
      query = query.gt("created_at", seenAt);
    }

    const important: string[] = my?.help_notify_categories || [];
    if (important.length > 0) {
      query = query.in("category", important);
    }

    const { data, error } = await query;
    if (error) return { seenAt, categories: [] };

    const categories: string[] = Array.from(
      new Set<string>((data || []).map((r: any) => String(r.category))),
    );

    return { seenAt, categories };
  } catch {
    return { seenAt: null, categories: [] };
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

  // Мостик для проверщика типов: список полей собран из двух строчек,
  // и подсказчик Supabase не может его прочитать — берём строку как есть.
  const p = post as any;

  let author: HelpAuthor | null = null;
  try {
    const { data: authorRow } = await supabase
      .from("users")
      .select(AUTHOR_FIELDS)
      .eq("id", p.author_id)
      .single();

    author = (authorRow as unknown as HelpAuthor) || null;
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
    id: p.id,
    category: p.category,
    postType: p.post_type as HelpPostType,
    body: p.body,
    status: p.status,
    hasHidden: !!p.has_hidden,
    commentsHidden: !!p.comments_hidden,
    createdAt: p.created_at,
    author,
    isMine: p.author_id === myUserId,
    hiddenBody,
    hiddenVisible: !!hiddenBody || sawHiddenAttachment,
    attachments,
  };
}

// ─────────────────────────────────────────────────────────────────────
// КОММЕНТАРИИ (Веха 53). Один уровень, «Ответить» на конкретное
// сообщение (reply_to). При comments_hidden правила базы сами отдают
// строки только автору поста, модераторам и подтверждённым
// специалистам категории — экран лишнего не увидит.

export type HelpCommentItem = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  replyTo: string | null; // id комментария, на который отвечают
  author: HelpAuthor | null;
  isMine: boolean; // мой комментарий — можно удалить
};

export async function getHelpComments(
  postId: string,
): Promise<HelpCommentItem[]> {
  const myUserId = await getCurrentUserId();

  const { data: rows, error } = await supabase
    .from("help_comments")
    .select("id, author_id, body, reply_to, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!rows || rows.length === 0) {
    return [];
  }

  // Авторы — вторым запросом, как везде.
  const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id)));
  const authorById = new Map<string, HelpAuthor>();
  try {
    const { data: authors } = await supabase
      .from("users")
      .select(AUTHOR_FIELDS)
      .in("id", authorIds);

    for (const a of authors || []) {
      const row = a as unknown as HelpAuthor;
      authorById.set(row.id, row);
    }
  } catch {
    // анкета может быть скрыта — комментарий выживет без автора
  }

  return rows.map((r: any) => ({
    id: r.id,
    authorId: r.author_id,
    body: r.body,
    createdAt: r.created_at,
    replyTo: r.reply_to || null,
    author: authorById.get(r.author_id) || null,
    isMine: r.author_id === myUserId,
  }));
}

// Новый комментарий (replyTo = null) или ответ (replyTo = id).
// Уведомления автору поста / автору исходного комментария шлют
// триггеры в базе — экрану ничего делать не нужно.
export async function addHelpComment(
  postId: string,
  body: string,
  replyTo: string | null,
): Promise<void> {
  const myUserId = await getCurrentUserId();

  const text = body.trim();
  if (!text) {
    throw new Error("Пустой комментарий");
  }

  const { error } = await supabase.from("help_comments").insert({
    post_id: postId,
    author_id: myUserId,
    body: text,
    reply_to: replyTo,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// Удаление: правило hc_delete в базе пускает автора комментария и
// автора поста. Удалённый исчезает совсем; у ответов на него пометка
// «кому» просто гаснет (ссылка reply_to обнуляется базой).
export async function deleteHelpComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("help_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    throw new Error(error.message);
  }
}

// Открыл пост — уведомления колокольчика про него гаснут (по образцу
// чата: тот гасит уведомления собеседника при входе). Ссылки триггеров
// ведут на /help-post?id=…, по ним и находим. Гашение — украшение:
// при любой ошибке молчим, пост важнее.
export async function markHelpPostNotificationsRead(
  postId: string,
): Promise<void> {
  try {
    const myUserId = await getCurrentUserId();

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", myUserId)
      .eq("is_read", false)
      .like("link", `%help-post?id=${postId}%`);
  } catch {
    // молчим
  }
}

// Подтверждённый ли я специалист этой категории — для показа скрытого
// обсуждения (правила базы решают сами; это только для вида экрана).
export async function canJoinHiddenDiscussion(
  category: string,
): Promise<boolean> {
  try {
    const myUserId = await getCurrentUserId();

    const { data } = await supabase
      .from("users")
      .select("category, qualification_confirmed_at")
      .eq("id", myUserId)
      .single();

    return !!data?.qualification_confirmed_at && data?.category === category;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// АРХИВ (Веха 53). Автор закрывает пост (читать можно, писать нельзя)
// и может вернуть его; правило hp_update пускает автора active↔archived.
// Закрытый пост ещё 3 дня висит в ленте серым, потом — только архив.

export async function closeHelpPost(postId: string): Promise<void> {
  const myUserId = await getCurrentUserId();
  const stamp = new Date().toISOString();

  let { error } = await supabase
    .from("help_posts")
    .update({ status: "archived", archived_at: stamp, archived_by: myUserId })
    .eq("id", postId)
    .eq("author_id", myUserId);

  // Страховка: если колонки archived_by в базе вдруг нет — закрываем
  // без неё, пост важнее следа.
  if (error && /archived_by/.test(error.message || "")) {
    ({ error } = await supabase
      .from("help_posts")
      .update({ status: "archived", archived_at: stamp })
      .eq("id", postId)
      .eq("author_id", myUserId));
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function reopenHelpPost(postId: string): Promise<void> {
  const myUserId = await getCurrentUserId();

  let { error } = await supabase
    .from("help_posts")
    .update({ status: "active", archived_at: null, archived_by: null })
    .eq("id", postId)
    .eq("author_id", myUserId);

  if (error && /archived_by/.test(error.message || "")) {
    ({ error } = await supabase
      .from("help_posts")
      .update({ status: "active", archived_at: null })
      .eq("id", postId)
      .eq("author_id", myUserId));
  }

  if (error) {
    throw new Error(error.message);
  }
}
