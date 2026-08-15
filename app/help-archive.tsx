// Архив Стены помощи + поиск (Веха 56).
// Все закрытые посты, новые сверху; строка поиска — по словам, терпимая
// к опечаткам (функция базы search_help_archive на pg_trgm ищет по тексту
// поста и по комментариям); чипы категорий — свой фильтр архива (не
// сохраняется). Нажатие на карточку → /help-post. Карточка общая с лентой
// (components/HelpPostCard).

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HelpPostCard from "../components/HelpPostCard";
import { Tekmet } from "../components/mingi";
import {
  HELP_CATEGORIES,
  HelpFeedItem,
  getHelpArchive,
} from "../services/helpService";

export default function HelpArchiveScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [posts, setPosts] = useState<HelpFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Свежий запрос для проверки «не устарел ли ответ» (быстрый набор).
  const requestRef = useRef(0);

  const load = useCallback(async (q: string, cats: string[]) => {
    const myRequest = ++requestRef.current;
    setError("");
    try {
      const items = await getHelpArchive(q, cats);
      if (myRequest !== requestRef.current) return; // пришёл поздно
      setPosts(items);
    } catch (e: any) {
      console.log("Архив не загрузился:", e);
      if (myRequest !== requestRef.current) return;
      setPosts([]);
      setError("Не удалось загрузить архив. Попробуйте ещё раз.");
    } finally {
      if (myRequest === requestRef.current) setLoading(false);
    }
  }, []);

  // Поиск с задержкой 400 мс после последней буквы — не дёргаем базу на
  // каждый символ.
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => load(query, filter), query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [query, filter, load]);

  const toggleCategory = (category: string) => {
    setFilter((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const searching = query.trim().length >= 2;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#3F6B5B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Архив</Text>

        <View style={styles.backButton} />
      </View>

      {/* Строка поиска — липкая, как в «Людях» */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#8FA79A" />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по завершённым постам…"
            placeholderTextColor="#8FA79A"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color="#96AC9E" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterIconButton,
            (filterOpen || filter.length > 0) && styles.filterIconButtonActive,
          ]}
          activeOpacity={0.8}
          onPress={() => setFilterOpen((v) => !v)}
          accessibilityLabel="Категории"
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={filterOpen || filter.length > 0 ? "#FFFFFF" : "#3F6B5B"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filterOpen && (
          <View style={styles.filterPanel}>
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
            {filter.length > 0 && (
              <TouchableOpacity
                onPress={() => setFilter([])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.resetText}>Сбросить категории</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.hint}>
          {searching
            ? `Найдено: ${loading ? "…" : posts.length}`
            : "Завершённые посты. Ищите по словам — опечатки не помеха."}
        </Text>

        {loading && (
          <ActivityIndicator
            color="#69B78D"
            style={{ marginTop: 30 }}
            size="small"
          />
        )}

        {!loading && !!error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && posts.length === 0 && (
          <View style={styles.emptyWrap}>
            <Tekmet style={styles.emptyTekmet} />
            <Text style={styles.emptyText}>
              {searching
                ? "Ничего не нашлось. Попробуйте другое слово."
                : filter.length > 0
                  ? "В этих категориях завершённых постов пока нет."
                  : "Архив пока пуст — завершённые посты появятся здесь."}
            </Text>
          </View>
        )}

        {!loading &&
          posts.map((post) => (
            <HelpPostCard
              key={post.id}
              post={post}
              onPress={() =>
                router.push({
                  pathname: "/help-post" as any,
                  params: { id: post.id },
                })
              }
            />
          ))}

        {!loading && posts.length > 0 && <Tekmet style={styles.footerTekmet} />}
      </ScrollView>
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },

  backButton: {
    width: 40,
    alignItems: "flex-start",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  headerTitle: {
    flex: 1,
    fontFamily: "Philosopher_700Bold",
    fontSize: 24,
    color: "#3F6B5B",
    textAlign: "center",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },

  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: "#2F4A3C",
    paddingVertical: 0,
  },

  filterIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  filterIconButtonActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(105,183,141,0.92)",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 60,
  },

  filterPanel: {
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#FFFFFF",
    padding: 14,
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

  resetText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#96AC9E",
    marginTop: 12,
  },

  hint: {
    fontSize: 12,
    color: "#96AC9E",
    marginBottom: 12,
  },

  errorText: {
    fontSize: 13,
    color: "#C05B4D",
    textAlign: "center",
    marginTop: 30,
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

  footerTekmet: {
    alignSelf: "center",
    marginTop: 10,
  },
});
