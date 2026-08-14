// Экран поста Стены помощи — ЗАГОТОВКА (Веха 52).
// Сюда ведут карточки ленты и ссылки из уведомлений (/help-post?id=…).
// Уже показывает: автора, чипы, текст, открытые фото, скрытый блок
// (если есть допуск) или плашку (если допуска нет).
// В Вехе 53 здесь появятся комментарии с ответами и закрытие в архив.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HelpPostDetails,
  POST_TYPE_LABELS,
  authorProfileParams,
  getHelpPost,
} from "../services/helpService";

export default function HelpPostScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const postId = String(params.id || "");

  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [post, setPost] = useState<HelpPostDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!postId) {
      setError("Пост не найден");
      setLoading(false);
      return;
    }

    try {
      const details = await getHelpPost(postId);
      setPost(details);
    } catch (e: any) {
      console.log("Пост не загрузился:", e);
      setError("Пост не найден или недоступен");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const authorName = post?.author
    ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() ||
      "Участник"
    : "Участник";

  const openPhotos = (post?.attachments || []).filter(
    (a) => !a.isHidden && (a.mimeType || "").startsWith("image/") && a.signedUrl,
  );

  const hiddenAttachments = (post?.attachments || []).filter(
    (a) => a.isHidden,
  );

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

        <Text style={styles.headerTitle}>Пост</Text>

        <View style={styles.backButton} />
      </View>

      {loading && (
        <ActivityIndicator
          color="#69B78D"
          style={{ marginTop: 60 }}
          size="small"
        />
      )}

      {!loading && !!error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && post && (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authorRow}>
            {/* Автор: нажатие ведёт в его профиль */}
            <TouchableOpacity
              style={styles.authorMain}
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
                    : require("../assets/default-avatar.png")
                }
                style={styles.avatar}
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {authorName}
                </Text>
                {!!post.author?.profession && (
                  <Text style={styles.authorProfession} numberOfLines={1}>
                    {post.author.profession}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

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
          </View>

          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{post.category}</Text>
          </View>

          <Text style={styles.body}>{post.body}</Text>

          {openPhotos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.signedUrl! }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}

          {/* Скрытый блок: содержимое при допуске, плашка — без него */}
          {post.hasHidden && post.hiddenVisible && (
            <View style={styles.hiddenBlock}>
              <View style={styles.hiddenHeader}>
                <Ionicons name="lock-open" size={15} color="#3F6B5B" />
                <Text style={styles.hiddenTitle}>Скрытый материал</Text>
              </View>

              {!!post.hiddenBody && (
                <Text style={styles.hiddenBody}>{post.hiddenBody}</Text>
              )}

              {hiddenAttachments.map((file) =>
                (file.mimeType || "").startsWith("image/") &&
                file.signedUrl ? (
                  <Image
                    key={file.id}
                    source={{ uri: file.signedUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <TouchableOpacity
                    key={file.id}
                    style={styles.docRow}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (file.signedUrl) Linking.openURL(file.signedUrl);
                    }}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#4E7364"
                    />
                    <Text style={styles.docName} numberOfLines={1}>
                      {file.fileName || "Файл"}
                    </Text>
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color="#96AC9E"
                    />
                  </TouchableOpacity>
                ),
              )}
            </View>
          )}

          {post.hasHidden && !post.hiddenVisible && (
            <View style={styles.hiddenLockedBlock}>
              <Ionicons name="lock-closed" size={16} color="#719686" />
              <Text style={styles.hiddenLockedText}>
                В посте есть скрытый материал — он доступен только
                подтверждённым специалистам категории «{post.category}».
              </Text>
            </View>
          )}

          {post.commentsHidden && (
            <View style={styles.hiddenLockedBlock}>
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color="#719686"
              />
              <Text style={styles.hiddenLockedText}>
                Обсуждение под этим постом доступно только автору и
                подтверждённым специалистам категории «{post.category}».
              </Text>
            </View>
          )}

          <View style={styles.commentsSoon}>
            <Ionicons
              name="chatbubbles-outline"
              size={18}
              color="#96AC9E"
            />
            <Text style={styles.commentsSoonText}>
              Комментарии появятся в следующем обновлении
            </Text>
          </View>
        </ScrollView>
      )}
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

  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 60,
  },

  errorText: {
    fontSize: 14,
    color: "#C05B4D",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 30,
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  authorMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: "#EAF4EE",
  },

  authorName: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  authorProfession: {
    fontSize: 12.5,
    color: "#719686",
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

  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 11,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    marginTop: 12,
  },

  categoryChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#4E7364",
  },

  body: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2F4A3C",
    marginTop: 12,
  },

  photo: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#EAF4EE",
    marginTop: 12,
  },

  hiddenBlock: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    backgroundColor: "#F4FAF4",
    padding: 14,
  },

  hiddenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  hiddenTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  hiddenBody: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
    marginTop: 8,
  },

  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  docName: {
    flex: 1,
    fontSize: 13,
    color: "#4E7364",
  },

  hiddenLockedBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#F4FAF4",
    padding: 14,
  },

  hiddenLockedText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#4E7364",
  },

  commentsSoon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
    paddingVertical: 18,
    borderTopWidth: 0.75,
    borderTopColor: "rgba(93,140,120,0.18)",
  },

  commentsSoonText: {
    fontSize: 13,
    color: "#96AC9E",
  },
});
