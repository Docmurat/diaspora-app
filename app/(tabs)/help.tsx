// Вкладка «Помощь» — лента Стены помощи (Веха 52).
// Заглушка «Скоро» уступила место живой ленте: карточки с чипами
// (категория + Вопрос/Предложение), окно фильтра по категориям,
// плавающая кнопка нового поста. При входе на вкладку пишем
// help_seen_at — точка на вкладке гаснет.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import TopBar from "../../components/TopBar";
import { Glass, Tekmet } from "../../components/mingi";
import {
  HELP_CATEGORIES,
  HelpFeedItem,
  POST_TYPE_LABELS,
  authorProfileParams,
  getHelpFeed,
  getMyHelpSettings,
  markHelpSeen,
  saveMyHelpFilter,
} from "../../services/helpService";
import { subscribeToChanges } from "../../services/liveService";

// «сегодня 14:05», «вчера», «12 авг»
function formatPostDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const sameDay = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday = date.toDateString() === yesterday.toDateString();

  if (sameDay) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `сегодня ${hh}:${mm}`;
  }

  if (wasYesterday) return "вчера";

  const months = [
    "янв",
    "фев",
    "мар",
    "апр",
    "мая",
    "июн",
    "июл",
    "авг",
    "сен",
    "окт",
    "ноя",
    "дек",
  ];

  const suffix =
    date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : "";

  return `${date.getDate()} ${months[date.getMonth()]}${suffix}`;
}

export default function HelpScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [posts, setPosts] = useState<HelpFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<string[]>([]);
  const [filterLoaded, setFilterLoaded] = useState(false);

  // Свежий фильтр для перезагрузок из подписки (замыкание не устаревает).
  const filterRef = useRef<string[]>([]);
  filterRef.current = filter;

  const loadFeed = useCallback(async (categories: string[]) => {
    try {
      const feed = await getHelpFeed(categories);
      setPosts(feed);
    } catch (e) {
      console.log("Ошибка загрузки Стены помощи:", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // При входе на вкладку: гасим точку, тянем фильтр и ленту.
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        markHelpSeen();

        let categories = filterRef.current;

        if (!filterLoaded) {
          try {
            const settings = await getMyHelpSettings();
            categories = settings.filterCategories;
            if (alive) {
              setFilter(categories);
              setFilterLoaded(true);
            }
          } catch {
            categories = [];
          }
        }

        if (alive) loadFeed(categories);
      })();

      return () => {
        alive = false;
      };
    }, [filterLoaded, loadFeed]),
  );

  // Живая лента: новый пост появляется сам, без кнопки «Обновить».
  useEffect(() => {
    const unsubscribe = subscribeToChanges(
      "help-feed",
      [{ table: "help_posts" }],
      () => loadFeed(filterRef.current),
    );

    return unsubscribe;
  }, [loadFeed]);

  const toggleCategory = (category: string) => {
    const next = filter.includes(category)
      ? filter.filter((c) => c !== category)
      : [...filter, category];

    setFilter(next);
    setLoading(true);
    loadFeed(next);

    // Сохраняем тихо: фильтр управляет ещё и уведомлениями (триггер в базе).
    saveMyHelpFilter(next).catch((e) =>
      console.log("Фильтр не сохранился:", e),
    );
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TopBar />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Стена помощи</Text>
        <Text style={styles.subtitle}>ВОПРОСЫ · ПРЕДЛОЖЕНИЯ</Text>

        {/* Кнопка фильтра + счётчик выбранных категорий */}
        <TouchableOpacity
          style={styles.filterButton}
          activeOpacity={0.8}
          onPress={() => setFilterOpen((v) => !v)}
        >
          <Ionicons
            name={filterOpen ? "options" : "options-outline"}
            size={17}
            color="#3F6B5B"
          />
          <Text style={styles.filterButtonText}>
            {filter.length === 0
              ? "Все категории"
              : `Категории: ${filter.length}`}
          </Text>
          <Ionicons
            name={filterOpen ? "chevron-up" : "chevron-down"}
            size={15}
            color="#719686"
          />
        </TouchableOpacity>

        {filterOpen && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterHint}>
              Показывать посты и присылать уведомления только по выбранным
              категориям. Ничего не выбрано — видно всё.
            </Text>

            <View style={styles.chipsWrap}>
              {HELP_CATEGORIES.map((category) => {
                const active = filter.includes(category);

                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.75}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {loading && (
          <ActivityIndicator
            color="#69B78D"
            style={{ marginTop: 40 }}
            size="small"
          />
        )}

        {!loading && posts.length === 0 && (
          <View style={styles.emptyWrap}>
            <Tekmet style={styles.emptyTekmet} />
            <Text style={styles.emptyText}>
              {filter.length > 0
                ? "По выбранным категориям пока нет постов. Ослабьте фильтр или создайте пост первым."
                : "Пока пусто. Создайте первый пост — задайте вопрос сообществу или предложите свою помощь."}
            </Text>
          </View>
        )}

        {!loading &&
          posts.map((post) => {
            const authorName = post.author
              ? `${post.author.first_name || ""} ${
                  post.author.last_name || ""
                }`.trim() || "Участник"
              : "Участник";

            const isClosed = post.status === "archived";

            // Старость — левая цветная граница карточки, один в один
            // приём statusLine из модерации (borderLeftWidth 3):
            // свежий — зелёная, 3+ дня — светлый янтарь, 6+ — янтарь.
            // Закрытый — серая граница на чисто сером фоне.
            const ageDays =
              (Date.now() - new Date(post.createdAt).getTime()) /
              (24 * 60 * 60 * 1000);

            const stripeColor = isClosed
              ? "#A8B0AB"
              : ageDays >= 6
                ? "#E0A33E"
                : ageDays >= 3
                  ? "#EBCC85"
                  : "#69B78D";

            return (
              <TouchableOpacity
                key={post.id}
                style={[
                  styles.card,
                  { borderLeftColor: stripeColor },
                  isClosed && styles.cardClosed,
                ]}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/help-post" as any,
                    params: { id: post.id },
                  })
                }
              >
                <View style={styles.cardTop}>
                  {/* Автор: нажатие ведёт в его профиль (как в «Людях») */}
                  <TouchableOpacity
                    style={styles.cardAuthor}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (!post.author) return;
                      router.push({
                        pathname: "/user-profile",
                        params: authorProfileParams(post.author),
                      });
                    }}
                  >
                    <Image
                      source={
                        post.author?.avatar_path
                          ? { uri: post.author.avatar_path }
                          : require("../../assets/default-avatar.png")
                      }
                      style={styles.cardAvatar}
                    />

                    <View style={styles.cardTopInfo}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {authorName}
                      </Text>
                      {!!post.author?.profession && (
                        <Text style={styles.cardProfession} numberOfLines={1}>
                          {post.author.profession}
                        </Text>
                      )}
                      <Text style={styles.cardDate}>
                        {formatPostDate(post.createdAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isClosed ? (
                    <View style={styles.closedChip}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#7E988B"
                      />
                      <Text style={styles.closedChipText}>Завершено</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.typeChip,
                        post.postType === "offer" && styles.typeChipOffer,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          post.postType === "offer" && styles.typeChipTextOffer,
                        ]}
                      >
                        {POST_TYPE_LABELS[post.postType]}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{post.category}</Text>
                  </View>

                  {post.hasHidden && (
                    <View style={styles.hiddenMark}>
                      <Ionicons name="lock-closed" size={11} color="#719686" />
                      <Text style={styles.hiddenMarkText}>
                        скрытый материал
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardBody} numberOfLines={4}>
                  {post.body}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={14}
                      color="#96AC9E"
                    />
                    <Text style={styles.footerText}>{post.commentCount}</Text>
                  </View>

                  {post.photoCount > 0 && (
                    <View style={styles.footerItem}>
                      <Ionicons
                        name="image-outline"
                        size={14}
                        color="#96AC9E"
                      />
                      <Text style={styles.footerText}>{post.photoCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

        {!loading && posts.length > 0 && <Tekmet style={styles.footerTekmet} />}
      </ScrollView>

      {/* Новый пост — плавающая кнопка над капсулой вкладок */}
      <TouchableOpacity
        style={styles.fabShadow}
        activeOpacity={0.85}
        onPress={() => router.push("/new-help-post" as any)}
      >
        <Glass
          radius={22}
          tintColor="rgba(105,183,141,0.92)"
          borderColor="rgba(255,255,255,0.85)"
        >
          <View style={styles.fabInner}>
            <Feather name="plus" size={20} color="#FFFFFF" />
          </View>
        </Glass>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // paddingBottom 120 — правило проекта: контент не должен навсегда
  // спрятаться под парящей капсулой вкладок.
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 34,
    color: "#3F6B5B",
    textAlign: "center",
  },

  subtitle: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 13.5,
    letterSpacing: 2.5,
    color: "#719686",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },

  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    marginBottom: 14,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  filterButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  filterPanel: {
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 16,
  },

  filterHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#7E988B",
    marginBottom: 12,
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  chipActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(105,183,141,0.92)",
  },

  chipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#4E7364",
  },

  chipTextActive: {
    color: "#FFFFFF",
  },

  emptyWrap: {
    alignItems: "center",
    marginTop: 44,
    paddingHorizontal: 12,
  },

  emptyTekmet: {
    marginBottom: 16,
  },

  emptyText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    maxWidth: 340,
  },

  // Карточка поста — белая, по правилу списков (без стекла).
  // Левая граница толщиной 3 — цвет старости, приём statusLine
  // из модерации (сверено по коду moderation.tsx).
  card: {
    borderRadius: 18,
    borderWidth: 0.75,
    borderLeftWidth: 3,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  // Закрытый пост: чисто серый, без желтизны — висит ещё 3 дня.
  cardClosed: {
    backgroundColor: "#F3F4F4",
    borderColor: "rgba(134,142,138,0.32)",
  },

  closedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(126,152,139,0.14)",
  },

  closedChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#7E988B",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardAuthor: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    marginRight: 10,
    backgroundColor: "#EAF4EE",
  },

  cardTopInfo: {
    flex: 1,
    minWidth: 0,
  },

  cardName: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  cardProfession: {
    fontSize: 12,
    color: "#719686",
    marginTop: 1,
  },

  cardDate: {
    fontSize: 12,
    color: "#96AC9E",
    marginTop: 1,
  },

  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(105,183,141,0.14)",
  },

  typeChipOffer: {
    backgroundColor: "rgba(224,163,62,0.14)",
  },

  typeChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  typeChipTextOffer: {
    color: "#A87A2A",
  },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },

  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 11,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
  },

  categoryChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#4E7364",
  },

  hiddenMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  hiddenMarkText: {
    fontSize: 11,
    color: "#719686",
  },

  cardBody: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
    marginTop: 9,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },

  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  footerText: {
    fontSize: 12,
    color: "#96AC9E",
  },

  footerTekmet: {
    alignSelf: "center",
    marginTop: 10,
  },

  // Кнопка нового поста — над капсулой вкладок, чтобы не спорить с ней.
  fabShadow: {
    position: "absolute",
    right: 20,
    bottom: 104,
    borderRadius: 22,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 30,
  },

  fabInner: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
