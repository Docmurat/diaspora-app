// Витрина демо-режима (для модераторов магазинов и скриншотов).
// Всё здесь ПРИДУМАНО: люди, публикации, переписка. Видно только
// демо-аккаунту (is_demo) — в базу ничего не пишется, настоящие
// участники этого никогда не видят. Все придуманные id начинаются
// с «demo-», по ним экраны узнают витринные данные.

import type { ChatListItem } from "../services/chatService";
import type {
  HelpAuthor,
  HelpCommentItem,
  HelpFeedItem,
  HelpPostDetails,
} from "../services/helpService";
import type { ChatMessage } from "../services/messageService";
import type { DirectoryUser } from "../services/userDirectoryService";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEMO_AVATARS } from "./demoAvatars";
import { withTimeout } from "./offline";
import { supabase } from "./supabase";

export const DEMO_ME_ID = "demo-me";

export function isDemoId(id?: string | null): boolean {
  return !!id && id.startsWith("demo-");
}

// ─────────────────────────────────────────────────────────────────────
// Я — демо-аккаунт? Узнаём один раз на пользователя и запоминаем
// (в памяти и на телефоне), чтобы без сети экраны не ждали сервер.
// Сессия читается из памяти телефона — работает и без сети.
const DEMO_KEY = "mingi.demo.v1";
let demoCache: { userId: string; isDemo: boolean } | null = null;

export async function amIDemo(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return false;
    if (demoCache && demoCache.userId === userId) return demoCache.isDemo;

    try {
      const raw = await AsyncStorage.getItem(DEMO_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.userId === userId && typeof saved.isDemo === "boolean") {
        demoCache = { userId, isDemo: saved.isDemo };
        return saved.isDemo;
      }
    } catch {
      // память телефона недоступна — спросим сервер
    }

    const { data: row, error } = await withTimeout(
      Promise.resolve(
        supabase.from("users").select("is_demo").eq("id", userId).maybeSingle(),
      ),
      3000,
    );
    if (error) return false; // не запоминаем — спросим в следующий раз
    const isDemo = !!row?.is_demo;
    demoCache = { userId, isDemo };
    AsyncStorage.setItem(DEMO_KEY, JSON.stringify(demoCache)).catch(() => {});
    return isDemo;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Время «столько-то назад» — чтобы витрина всегда выглядела свежей.
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// Дата рождения под нужный возраст (день рождения уже прошёл в этом году).
function bornFor(age: number, month: number, day: number): string {
  const year = new Date().getFullYear() - age;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────────────
// ЛЮДИ
type DemoPerson = {
  id: string;
  first: string;
  last: string;
  age: number;
  category: string;
  profession: string;
  country: string;
  city: string;
  bio: string;
};

const PEOPLE: DemoPerson[] = [
  {
    id: "demo-u01",
    first: "Азамат",
    last: "Байрамуков",
    age: 38,
    category: "Медицина",
    profession: "Стоматолог",
    country: "Россия",
    city: "Москва",
    bio: "Лечу зубы уже 10 лет. Землякам всегда помогу советом, пишите.",
  },
  {
    id: "demo-u02",
    first: "Зарема",
    last: "Узденова",
    age: 29,
    category: "Юриспруденция",
    profession: "Юрист по семейным делам",
    country: "Россия",
    city: "Черкесск",
    bio: "Помогаю с разводами, алиментами и наследством. Первая консультация для своих — бесплатно.",
  },
  {
    id: "demo-u03",
    first: "Алим",
    last: "Мокаев",
    age: 41,
    category: "Строительство и недвижимость",
    profession: "Прораб",
    country: "Россия",
    city: "Нальчик",
    bio: "Строю частные дома под ключ. Подскажу по смете и материалам.",
  },
  {
    id: "demo-u04",
    first: "Мадина",
    last: "Лайпанова",
    age: 33,
    category: "Образование",
    profession: "Учитель английского",
    country: "Россия",
    city: "Кисловодск",
    bio: "Готовлю школьников к ОГЭ и ЕГЭ. Люблю, когда у ребёнка загораются глаза.",
  },
  {
    id: "demo-u05",
    first: "Ислам",
    last: "Эбзеев",
    age: 31,
    category: "IT и технологии",
    profession: "Программист",
    country: "Россия",
    city: "Санкт-Петербург",
    bio: "Пишу мобильные приложения. Помогу землякам войти в IT.",
  },
  {
    id: "demo-u06",
    first: "Фатима",
    last: "Энеева",
    age: 38,
    category: "Медицина",
    profession: "Педиатр",
    country: "Россия",
    city: "Нальчик",
    bio: "Детский врач, мама троих детей. Отвечу на вопросы о здоровье малышей.",
  },
  {
    id: "demo-u07",
    first: "Расул",
    last: "Кипкеев",
    age: 45,
    category: "Логистика и транспорт",
    profession: "Грузоперевозки",
    country: "Россия",
    city: "Ставрополь",
    bio: "Вожу грузы по всему югу и до Москвы. Посылку землякам захвачу.",
  },
  {
    id: "demo-u08",
    first: "Лейла",
    last: "Малкарова",
    age: 27,
    category: "Дизайн и творчество",
    profession: "Дизайнер интерьеров",
    country: "Россия",
    city: "Москва",
    bio: "Делаю уютные квартиры. Люблю национальные мотивы в интерьере.",
  },
  {
    id: "demo-u09",
    first: "Тимур",
    last: "Хубиев",
    age: 36,
    category: "Бизнес и финансы",
    profession: "Бухгалтер",
    country: "Россия",
    city: "Черкесск",
    bio: "Веду бухгалтерию малого бизнеса и ИП. Помогу с налоговым вычетом.",
  },
  {
    id: "demo-u10",
    first: "Аминат",
    last: "Гуртуева",
    age: 33,
    category: "Маркетинг и медиа",
    profession: "SMM-специалист",
    country: "Турция",
    city: "Стамбул",
    bio: "Живу в Стамбуле 5 лет. Подскажу землякам, как здесь устроиться.",
  },
  {
    id: "demo-u11",
    first: "Солтан",
    last: "Боташев",
    age: 52,
    category: "Государственная служба",
    profession: "Специалист администрации",
    country: "Россия",
    city: "Карачаевск",
    bio: "Подскажу, куда обратиться с документами и как не потерять время.",
  },
  {
    id: "demo-u12",
    first: "Халимат",
    last: "Теммоева",
    age: 30,
    category: "Спорт и здоровье",
    profession: "Фитнес-тренер",
    country: "Россия",
    city: "Краснодар",
    bio: "Тренирую онлайн и в зале. Здоровье — это привычка.",
  },
  {
    id: "demo-u13",
    first: "Хасан",
    last: "Чотчаев",
    age: 39,
    category: "Услуги и сервис",
    profession: "Автосервис",
    country: "Россия",
    city: "Черкесск",
    bio: "Ремонт и диагностика авто. Своим — без очереди.",
  },
  {
    id: "demo-u14",
    first: "Джамал",
    last: "Этезов",
    age: 24,
    category: "Наука и исследования",
    profession: "Аспирант-химик",
    country: "Россия",
    city: "Казань",
    bio: "Изучаю новые материалы. Помогу школьникам с химией.",
  },
];

// Небольшой разброс дней рождения, чтобы даты не были одинаковыми.
function birthOf(p: DemoPerson, index: number): string {
  return bornFor(p.age, (index % 8) + 1, ((index * 3) % 25) + 2);
}

export const DEMO_USERS: DirectoryUser[] = PEOPLE.map((p, i) => ({
  id: p.id,
  email: null,
  first_name: p.first,
  last_name: p.last,
  birth_date: birthOf(p, i),
  country: p.country,
  city: p.city,
  category: p.category,
  profession: p.profession,
  bio: p.bio,
  telegram: null,
  extra_info: null,
  avatar_path: DEMO_AVATARS[p.id] || null,
  moderation_status: "approved",
  role: "user",
  is_blocked: false,
  is_deleted: false,
}));

export function getDemoUser(id: string): DirectoryUser | null {
  return DEMO_USERS.find((u) => u.id === id) || null;
}

function author(id: string): HelpAuthor | null {
  const u = getDemoUser(id);
  if (!u) return null;
  return {
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    avatar_path: u.avatar_path,
    profession: u.profession,
    category: u.category,
    city: u.city,
    country: u.country,
    birth_date: u.birth_date,
    telegram: null,
    bio: u.bio,
    extra_info: null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// СТЕНА ПОМОЩИ
type DemoComment = { id: string; authorId: string; body: string; minutesAgo: number };

type DemoPost = {
  id: string;
  authorId: string;
  category: string;
  postType: "question" | "offer";
  body: string;
  hasHidden: boolean;
  minutesAgo: number;
  comments: DemoComment[];
};

const POSTS: DemoPost[] = [
  {
    id: "demo-p1",
    authorId: "demo-u06",
    category: "Медицина",
    postType: "question",
    body: "Ребёнку 3 года, часто болеет ангиной. Посоветуйте хорошего ЛОР-врача в Нальчике или Пятигорске.",
    hasHidden: true,
    minutesAgo: 45,
    comments: [
      {
        id: "demo-c1",
        authorId: "demo-u01",
        body: "В Пятигорске хороший детский ЛОР в краевой больнице, напишу вам в личку контакты.",
        minutesAgo: 30,
      },
    ],
  },
  {
    id: "demo-p2",
    authorId: "demo-u07",
    category: "Логистика и транспорт",
    postType: "offer",
    body: "Еду из Ставрополя в Москву 5 октября, в машине есть место под небольшой груз или посылку. Землякам бесплатно.",
    hasHidden: false,
    minutesAgo: 3 * 60,
    comments: [],
  },
  {
    id: "demo-p3",
    authorId: "demo-u05",
    category: "Строительство и недвижимость",
    postType: "question",
    body: "Переезжаю в Москву в ноябре. Подскажите, в каких районах удобно снимать квартиру и на что смотреть в договоре?",
    hasHidden: false,
    minutesAgo: 7 * 60,
    comments: [
      {
        id: "demo-c2",
        authorId: "demo-u08",
        body: "Смотрите в сторону Юго-Запада, там много наших.",
        minutesAgo: 6 * 60,
      },
      {
        id: "demo-c3",
        authorId: "demo-u02",
        body: "Договор скиньте мне перед подписанием, посмотрю бесплатно.",
        minutesAgo: 5 * 60,
      },
    ],
  },
  {
    id: "demo-p4",
    authorId: "demo-u04",
    category: "Образование",
    postType: "offer",
    body: "Бесплатно помогу школьникам подготовиться к ОГЭ по английскому, занятия онлайн по выходным.",
    hasHidden: false,
    minutesAgo: 26 * 60,
    comments: [],
  },
  {
    id: "demo-p5",
    authorId: "demo-u13",
    category: "Юриспруденция",
    postType: "question",
    body: "Купил подержанную машину, а у неё оказался залог в банке. Что можно сделать?",
    hasHidden: true,
    minutesAgo: 2 * 24 * 60,
    comments: [],
  },
  {
    id: "demo-p6",
    authorId: "demo-u12",
    category: "Дом и быт",
    postType: "offer",
    body: "Отдам детскую коляску и автокресло в хорошем состоянии, Краснодар. Самовывоз.",
    hasHidden: false,
    minutesAgo: 3 * 24 * 60,
    comments: [],
  },
];

export function getDemoFeed(categories: string[]): HelpFeedItem[] {
  return POSTS.filter(
    (p) => categories.length === 0 || categories.includes(p.category),
  ).map((p) => ({
    id: p.id,
    category: p.category,
    postType: p.postType,
    body: p.body,
    status: "active",
    hasHidden: p.hasHidden,
    commentsHidden: false,
    createdAt: ago(p.minutesAgo),
    author: author(p.authorId),
    commentCount: p.comments.length,
    photoCount: 0,
    thumbUrls: [],
    isMine: false,
  }));
}

export function getDemoPost(id: string): HelpPostDetails | null {
  const p = POSTS.find((x) => x.id === id);
  if (!p) return null;
  return {
    id: p.id,
    category: p.category,
    postType: p.postType,
    body: p.body,
    status: "active",
    hasHidden: p.hasHidden,
    commentsHidden: false,
    createdAt: ago(p.minutesAgo),
    author: author(p.authorId),
    isMine: false,
    hiddenBody: null,
    hiddenVisible: false,
    attachments: [],
    blockedReason: null,
  };
}

export function getDemoComments(postId: string): HelpCommentItem[] {
  const p = POSTS.find((x) => x.id === postId);
  if (!p) return [];
  return p.comments.map((c) => ({
    id: c.id,
    authorId: c.authorId,
    body: c.body,
    createdAt: ago(c.minutesAgo),
    replyTo: null,
    author: author(c.authorId),
    isMine: false,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// ПЕРЕПИСКА. mine: true — сообщение демо-аккаунта.
type DemoLine = { mine: boolean; text: string; minutesAgo: number };

const DIALOGS: Record<string, DemoLine[]> = {
  "demo-u01": [
    {
      mine: true,
      text: "Ассаламу алайкум, Азамат! Увидел вас в Минги-Тау. Болит зуб уже третий день, можно к вам попасть?",
      minutesAgo: 52,
    },
    {
      mine: false,
      text: "Уа алайкум ассалам! Конечно. Что беспокоит — на холодное реагирует или ноет постоянно?",
      minutesAgo: 48,
    },
    { mine: true, text: "Ноет постоянно, особенно ночью", minutesAgo: 45 },
    {
      mine: false,
      text: "Похоже на пульпит, тянуть не стоит. Могу принять в четверг после обеда",
      minutesAgo: 41,
    },
    { mine: true, text: "В 15:00 удобно?", minutesAgo: 39 },
    { mine: false, text: "Хорошо, жду вас в четверг в 15:00", minutesAgo: 37 },
  ],
  "demo-u05": [
    {
      mine: true,
      text: "Ислам, посмотрел ваш вопрос про Москву. Могу подсказать по районам",
      minutesAgo: 5 * 60,
    },
    { mine: false, text: "Спасибо, очень помогли!", minutesAgo: 4 * 60 + 40 },
  ],
  "demo-u04": [
    {
      mine: true,
      text: "Мадина, здравствуйте! Сыну 15 лет, хотим позаниматься английским",
      minutesAgo: 25 * 60,
    },
    { mine: false, text: "Ссылку на занятие пришлю в субботу", minutesAgo: 24 * 60 },
  ],
  "demo-u07": [
    {
      mine: true,
      text: "Расул, спасибо, что взялись передать посылку!",
      minutesAgo: 3 * 24 * 60,
    },
    {
      mine: false,
      text: "Посылку забрал, 6-го утром буду в Москве",
      minutesAgo: 3 * 24 * 60 - 20,
    },
  ],
};

export function getDemoMessages(otherId: string): ChatMessage[] {
  const lines = DIALOGS[otherId] || [];
  return lines.map((line, i) => {
    const at = ago(line.minutesAgo);
    return {
      id: `demo-m-${otherId}-${i}`,
      chat_id: `demo-chat-${otherId}`,
      sender_id: line.mine ? DEMO_ME_ID : otherId,
      text: line.text,
      created_at: at,
      updated_at: at,
      is_deleted: false,
      attachment_path: null,
      attachment_type: null,
      attachment_name: null,
      attachment_size: null,
      attachmentUrl: null,
    };
  });
}

export function getDemoChats(): ChatListItem[] {
  return Object.keys(DIALOGS)
    .map((otherId) => {
      const lines = DIALOGS[otherId];
      const last = lines[lines.length - 1];
      const u = getDemoUser(otherId);
      const at = ago(last.minutesAgo);
      return {
        chatId: `demo-chat-${otherId}`,
        createdAt: ago(lines[0].minutesAgo),
        updatedAt: at,
        lastMessageText: last.text,
        lastMessageAt: at,
        // Первый диалог — с непрочитанным, чтобы видно было метку.
        unreadCount: otherId === "demo-u05" ? 1 : 0,
        otherUser: u
          ? {
              id: u.id,
              first_name: u.first_name,
              last_name: u.last_name,
              avatar_path: u.avatar_path,
              profession: u.profession,
              category: u.category,
              city: u.city,
            }
          : null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt || 0).getTime() -
        new Date(a.lastMessageAt || 0).getTime(),
    );
}
