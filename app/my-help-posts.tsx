// Мои посты Стены помощи (Веха 59, кабинет → «Мои посты»).
// Две вкладки: «Открытые» (вместе с заблокированными — автор их видит) и
// «В архиве». Карточки те же, что в ленте (HelpPostCard), нажатие → пост.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HelpPostCard from "../components/HelpPostCard";
import { Tekmet } from "../components/mingi";
import { HelpFeedItem, getMyHelpPosts } from "../services/helpService";

export default function MyHelpPostsScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [tab, setTab] = useState<"open" | "archived">("open");
  const [openPosts, setOpenPosts] = useState<HelpFeedItem[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<HelpFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Перечитываем при каждом возврате на экран: пост могли только что
  // завершить, вернуть или удалить.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setError("");
        try {
          const { open, archived } = await getMyHelpPosts();
          if (!alive) return;
          setOpenPosts(open);
          setArchivedPosts(archived);
        } catch (e) {
          console.log("Мои посты не загрузились:", e);
          if (alive) setError("Не удалось загрузить посты. Попробуйте ещё раз.");
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const posts = tab === "open" ? openPosts : archivedPosts;

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

        <Text style={styles.headerTitle}>Мои посты</Text>

        <View style={styles.backButton} />
      </View>

      {/* Вкладки — как в модерации: Открытые / В архиве */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "open" && styles.tabActive]}
          activeOpacity={0.8}
          onPress={() => setTab("open")}
        >
          <Text style={[styles.tabText, tab === "open" && styles.tabTextActive]}>
            Открытые{openPosts.length > 0 ? ` · ${openPosts.length}` : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === "archived" && styles.tabActive]}
          activeOpacity={0.8}
          onPress={() => setTab("archived")}
        >
          <Text
            style={[styles.tabText, tab === "archived" && styles.tabTextActive]}
          >
            В архиве{archivedPosts.length > 0 ? ` · ${archivedPosts.length}` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
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
              {tab === "open"
                ? "Открытых постов пока нет. Создайте первый на вкладке «Помощь»."
                : "В архиве пока пусто — сюда попадают завершённые посты."}
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

  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  tabActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(105,183,141,0.92)",
  },

  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4E7364",
  },

  tabTextActive: {
    color: "#FFFFFF",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 60,
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
