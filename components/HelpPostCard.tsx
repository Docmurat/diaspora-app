// Карточка поста Стены помощи — одна на ленту и архив (Веха 56).
// Вид утверждён в Вехах 52–54: автор с профессией и датой, чип типа
// (или «Завершено» у закрытого), чип категории, метка «новое», пометка
// скрытого материала, текст до 4 строк, миниатюры открытых фото (до 3,
// «+N»), счётчики комментариев и фото. Карточка целиком открывает пост.

import { Ionicons } from "@expo/vector-icons";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { HelpFeedItem, POST_TYPE_LABELS } from "../services/helpService";

// «сегодня 14:05», «вчера», «12 авг»
export function formatPostDate(iso: string): string {
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

export default function HelpPostCard({
  post,
  isNew = false,
  onPress,
}: {
  post: HelpFeedItem;
  isNew?: boolean;
  onPress: () => void;
}) {
  const authorName = post.author
    ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() ||
      "Участник"
    : "Участник";

  const isClosed = post.status === "archived";
  const isBlocked = post.status === "blocked"; // только у автора (Веха 57)

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isClosed && styles.cardClosed,
        isBlocked && styles.cardBlocked,
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardAuthor}>
          <Image
            source={
              post.author?.avatar_path
                ? { uri: post.author.avatar_path }
                : require("../assets/default-avatar.png")
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
            <Text style={styles.cardDate}>{formatPostDate(post.createdAt)}</Text>
          </View>
        </View>

        {isBlocked ? (
          <View style={styles.blockedChip}>
            <Ionicons name="hand-left" size={12} color="#A2543F" />
            <Text style={styles.blockedChipText}>Заблокирован</Text>
          </View>
        ) : isClosed ? (
          <View style={styles.closedChip}>
            <Ionicons name="checkmark-circle" size={13} color="#7E988B" />
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

        {isNew && (
          <View style={styles.newMark}>
            <View style={styles.newMarkDot} />
            <Text style={styles.newMarkText}>новое</Text>
          </View>
        )}

        {post.hasHidden && (
          <View style={styles.hiddenMark}>
            <Ionicons name="lock-closed" size={11} color="#719686" />
            <Text style={styles.hiddenMarkText}>скрытый материал</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardBody} numberOfLines={4}>
        {post.body}
      </Text>

      {/* Миниатюры открытых фото — как в Threads: ряд до трёх,
          одна — пошире, две-три — квадратные. */}
      {post.thumbUrls.length > 0 && (
        <View style={styles.thumbRow}>
          {post.thumbUrls.map((url, i) => (
            <View
              key={`${post.id}-t${i}`}
              style={[
                styles.thumbWrap,
                post.thumbUrls.length === 1 && styles.thumbWrapSingle,
              ]}
            >
              <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
              {i === 2 && post.photoCount > 3 && (
                <View style={styles.thumbMore}>
                  <Text style={styles.thumbMoreText}>+{post.photoCount - 3}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="chatbubble-outline" size={14} color="#96AC9E" />
          <Text style={styles.footerText}>{post.commentCount}</Text>
        </View>

        {post.photoCount > 0 && (
          <View style={styles.footerItem}>
            <Ionicons name="image-outline" size={14} color="#96AC9E" />
            <Text style={styles.footerText}>{post.photoCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Карточка поста — белая, по правилу списков (без стекла).
  card: {
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  // Закрытый пост: чисто серый, без желтизны.
  cardClosed: {
    backgroundColor: "#F3F4F4",
    borderColor: "rgba(134,142,138,0.32)",
  },

  // Заблокированный пост — виден только автору, красным (Веха 57)
  cardBlocked: {
    backgroundColor: "rgba(192,91,77,0.06)",
    borderColor: "rgba(192,91,77,0.35)",
  },

  blockedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(192,91,77,0.12)",
  },

  blockedChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#A2543F",
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

  newMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  newMarkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(105,183,141,1)",
  },

  newMarkText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3F6B5B",
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

  thumbRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },

  thumbWrap: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EAF4EE",
    maxWidth: "33%",
  },

  thumbWrapSingle: {
    aspectRatio: 16 / 10,
    maxWidth: "100%",
  },

  thumb: {
    width: "100%",
    height: "100%",
  },

  thumbMore: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(47,74,60,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  thumbMoreText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
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
});
