// Экран поста Стены помощи (Веха 53).
// Сюда ведут карточки ленты и ссылки из уведомлений (/help-post?id=…).
// Показывает: пост целиком (автор, чипы, текст, фото, скрытый блок или
// плашку), обсуждение — комментарии с ответами в один уровень (как в
// Threads), поле ввода, закрытие поста в архив и возврат из архива.
// Скрытое обсуждение (comments_hidden): ленту видят и пишут только
// автор поста и подтверждённые специалисты категории — правила базы
// сами не отдают лишнего, экран лишь показывает плашку остальным.
// Удалить комментарий может его автор и автор поста; подтверждение —
// вторым нажатием (системное окошко в браузере не работает).

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HelpCommentItem,
  HelpPostDetails,
  POST_TYPE_LABELS,
  addHelpComment,
  authorProfileParams,
  canJoinHiddenDiscussion,
  closeHelpPost,
  deleteHelpComment,
  getHelpComments,
  getHelpPost,
  markHelpPostNotificationsRead,
  reopenHelpPost,
} from "../services/helpService";
import { subscribeToChanges } from "../services/liveService";

// «14.08, 15:32» — коротко и без библиотек.
function formatWhen(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}, ${hh}:${mi}`;
}

function shortName(author: HelpCommentItem["author"]) {
  if (!author) return "Участник";
  return (
    `${author.first_name || ""} ${author.last_name || ""}`.trim() || "Участник"
  );
}

export default function HelpPostScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const postId = String(params.id || "");

  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  // Таймеры «взведённых» кнопок: через 4 секунды без второго нажатия
  // кнопка возвращается в обычный вид.
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [post, setPost] = useState<HelpPostDetails | null>(null);
  const [comments, setComments] = useState<HelpCommentItem[]>([]);
  const [specialist, setSpecialist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<HelpCommentItem | null>(null);
  const [actionError, setActionError] = useState("");

  // Подтверждение вторым нажатием.
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [closeArmed, setCloseArmed] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const disarmLater = () => {
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => {
      setDeleteArmedId(null);
      setCloseArmed(false);
    }, 4000);
  };

  // Загрузка. quiet=true — тихое обновление без крутилки
  // (живые события, действия пользователя).
  const load = useCallback(
    async (quiet: boolean) => {
      if (!postId) {
        setError("Пост не найден");
        setLoading(false);
        return;
      }

      try {
        const details = await getHelpPost(postId);
        setPost(details);
        setError("");

        // Уведомления колокольчика про этот пост — прочитаны (и при
        // входе, и при живых обновлениях, пока экран открыт — как чат).
        markHelpPostNotificationsRead(postId);

        try {
          const list = await getHelpComments(postId);
          setComments(list);
        } catch {
          // при скрытом обсуждении без допуска база вернёт пусто или
          // откажет — это не ошибка экрана
          setComments([]);
        }

        if (details.commentsHidden && !details.isMine) {
          setSpecialist(await canJoinHiddenDiscussion(details.category));
        }
      } catch (e: any) {
        console.log("Пост не загрузился:", e);
        if (!quiet) setError("Пост не найден или недоступен");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [postId],
  );

  // Тихо перечитать ТОЛЬКО комментарии — сам пост (и его фото) не
  // трогаем, чтобы экран не мигал при каждом новом комментарии.
  const reloadComments = useCallback(async () => {
    if (!postId) return;
    try {
      const list = await getHelpComments(postId);
      setComments(list);
    } catch {
      setComments([]);
    }
    markHelpPostNotificationsRead(postId);
  }, [postId]);

  useEffect(() => {
    load(false);

    if (!postId) return;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Живое обновление: новые комментарии и перемены самого поста
    // (закрыли/вернули/заблокировали) приезжают сами.
    // help_comments — БЕЗ фильтра по посту: событие удаления несёт только
    // id строки и фильтр по post_id его не пропускало (чужое удаление не
    // долетало). Перечитать пост при любом событии — дёшево, как в чате.
    // Одна подписка на комментарии (перечитывает только их), другая —
    // на сам пост (закрыли/вернули/заблокировали — перечитать целиком).
    const unsubComments = subscribeToChanges(
      "help-post-comments",
      [{ table: "help_comments" }],
      () => {
        reloadComments();
      },
    );
    const unsubPost = subscribeToChanges(
      "help-post",
      [{ table: "help_posts", filter: { column: "id", value: postId } }],
      () => {
        load(true);
      },
    );
    unsubscribeRef.current = () => {
      unsubComments();
      unsubPost();
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    };
  }, [postId, load, reloadComments]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !post) return;

    setSending(true);
    setActionError("");
    try {
      await addHelpComment(post.id, text, replyTo ? replyTo.id : null);
      setInput("");
      setReplyTo(null);
      await reloadComments();
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        150,
      );
    } catch (e: any) {
      console.log("Комментарий не отправился:", e);
      setActionError("Не удалось отправить. Попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (comment: HelpCommentItem) => {
    if (deleteArmedId !== comment.id) {
      setDeleteArmedId(comment.id);
      setCloseArmed(false);
      disarmLater();
      return;
    }

    setDeleteArmedId(null);
    setActionError("");
    try {
      await deleteHelpComment(comment.id);
      if (replyTo?.id === comment.id) setReplyTo(null);
      await reloadComments();
    } catch (e: any) {
      console.log("Комментарий не удалился:", e);
      setActionError("Не удалось удалить комментарий.");
    }
  };

  const handleToggleStatus = async () => {
    if (!post || statusBusy) return;

    if (!closeArmed) {
      setCloseArmed(true);
      setDeleteArmedId(null);
      disarmLater();
      return;
    }

    setCloseArmed(false);
    setStatusBusy(true);
    setActionError("");
    try {
      if (post.status === "active") {
        await closeHelpPost(post.id);
      } else {
        await reopenHelpPost(post.id);
      }
      await load(true);
    } catch (e: any) {
      console.log("Статус поста не сменился:", e);
      setActionError("Не удалось изменить статус поста.");
    } finally {
      setStatusBusy(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const authorName = post?.author
    ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() ||
      "Участник"
    : "Участник";

  const openPhotos = (post?.attachments || []).filter(
    (a) =>
      !a.isHidden && (a.mimeType || "").startsWith("image/") && a.signedUrl,
  );

  const hiddenAttachments = (post?.attachments || []).filter((a) => a.isHidden);

  // Допуск к обсуждению при comments_hidden: автор поста или
  // подтверждённый специалист категории. (Комментарии, пришедшие из
  // базы, тоже считаются допуском — правила лишнего не отдают.)
  const discussionAllowed =
    !post?.commentsHidden || post?.isMine || specialist || comments.length > 0;

  const canWrite = !!post && post.status === "active" && discussionAllowed;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#3F6B5B" />
        </TouchableOpacity>

        {/* Заголовок «Пост» убран по решению владельца — только стрелка. */}
        <View style={{ flex: 1 }} />

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
        <>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
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
                  post.status === "archived" && styles.typeChipDone,
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    post.postType === "offer" && styles.typeChipTextOffer,
                    post.status === "archived" && styles.typeChipTextDone,
                  ]}
                >
                  {post.status === "archived"
                    ? "✓ Завершено"
                    : POST_TYPE_LABELS[post.postType]}
                </Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{post.category}</Text>
              </View>
              <Text style={styles.dateText}>{formatWhen(post.createdAt)}</Text>
            </View>

            {/* Плашки состояния поста */}
            {post.status === "archived" && (
              <View style={styles.statusBanner}>
                <Ionicons name="archive-outline" size={16} color="#6B7570" />
                <Text style={styles.statusBannerText}>
                  Пост завершён и убран в архив: читать можно, писать нельзя.
                </Text>
              </View>
            )}

            {post.status === "blocked" && (
              <View style={[styles.statusBanner, styles.statusBannerBlocked]}>
                <Ionicons name="hand-left-outline" size={16} color="#A2543F" />
                <Text
                  style={[
                    styles.statusBannerText,
                    styles.statusBannerTextBlocked,
                  ]}
                >
                  Пост скрыт модерацией и виден только вам. Оспорить решение
                  можно через обращение к администрации.
                </Text>
              </View>
            )}

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

            {/* Кнопка автора: завершить / вернуть. Вторым нажатием. */}
            {post.isMine && post.status !== "blocked" && (
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  post.status === "archived" && styles.statusButtonReopen,
                  closeArmed && styles.statusButtonArmed,
                ]}
                activeOpacity={0.8}
                disabled={statusBusy}
                onPress={handleToggleStatus}
              >
                {statusBusy ? (
                  <ActivityIndicator size="small" color="#4E7364" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        post.status === "active"
                          ? "checkmark-done-outline"
                          : "refresh-outline"
                      }
                      size={17}
                      color={closeArmed ? "#A2543F" : "#4E7364"}
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        closeArmed && styles.statusButtonTextArmed,
                      ]}
                    >
                      {closeArmed
                        ? post.status === "active"
                          ? "Точно завершить? Нажмите ещё раз"
                          : "Точно вернуть? Нажмите ещё раз"
                        : post.status === "active"
                          ? "Завершить и убрать в архив"
                          : "Вернуть из архива"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* ОБСУЖДЕНИЕ */}
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Обсуждение</Text>
              {comments.length > 0 && (
                <Text style={styles.commentsCount}>{comments.length}</Text>
              )}
              {post.commentsHidden && discussionAllowed && (
                <View style={styles.hiddenTag}>
                  <Ionicons name="lock-closed" size={11} color="#719686" />
                  <Text style={styles.hiddenTagText}>скрытое</Text>
                </View>
              )}
            </View>

            {/* Плашка для тех, кому скрытое обсуждение недоступно */}
            {post.commentsHidden && !discussionAllowed && (
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

            {discussionAllowed && comments.length === 0 && (
              <Text style={styles.noComments}>
                {post.status === "active"
                  ? "Пока никто не написал. Будьте первым!"
                  : "Обсуждения не было."}
              </Text>
            )}

            {discussionAllowed &&
              comments.map((comment) => {
                const parent = comment.replyTo
                  ? comments.find((c) => c.id === comment.replyTo) || null
                  : null;
                const canDelete = comment.isMine || post.isMine;
                const armed = deleteArmedId === comment.id;

                return (
                  <View key={comment.id} style={styles.commentRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        if (!comment.author) return;
                        router.push({
                          pathname: "/user-profile",
                          params: authorProfileParams(comment.author),
                        });
                      }}
                    >
                      <Image
                        source={
                          comment.author?.avatar_path
                            ? { uri: comment.author.avatar_path }
                            : require("../assets/default-avatar.png")
                        }
                        style={styles.commentAvatar}
                      />
                    </TouchableOpacity>

                    <View style={styles.commentBubble}>
                      <View style={styles.commentTopRow}>
                        <Text style={styles.commentName} numberOfLines={1}>
                          {shortName(comment.author)}
                        </Text>
                        <Text style={styles.commentTime}>
                          {formatWhen(comment.createdAt)}
                        </Text>
                      </View>

                      {/* Кому отвечают. Если исходный комментарий удалён —
                          пометка просто не показывается. */}
                      {parent && (
                        <View style={styles.replyTag}>
                          <Ionicons
                            name="return-down-forward-outline"
                            size={13}
                            color="#719686"
                          />
                          <Text style={styles.replyTagText} numberOfLines={1}>
                            {shortName(parent.author)}: {parent.body}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.commentBody}>{comment.body}</Text>

                      <View style={styles.commentActions}>
                        {canWrite && (
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => {
                              setReplyTo(comment);
                              setDeleteArmedId(null);
                            }}
                          >
                            <Text style={styles.commentActionText}>
                              Ответить
                            </Text>
                          </TouchableOpacity>
                        )}

                        {canDelete && (
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => handleDelete(comment)}
                          >
                            <Text
                              style={[
                                styles.commentActionText,
                                styles.commentDeleteText,
                                armed && styles.commentDeleteArmed,
                              ]}
                            >
                              {armed ? "Точно удалить?" : "Удалить"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}

            {!!actionError && (
              <TouchableOpacity onPress={() => setActionError("")}>
                <Text style={styles.actionErrorText}>{actionError}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Поле ввода — только если писать можно */}
          {canWrite && (
            <View
              style={[
                styles.inputDock,
                { paddingBottom: Math.max(insets.bottom, 10) + 6 },
              ]}
            >
              {replyTo && (
                <View style={styles.replyBar}>
                  <Ionicons
                    name="return-down-forward-outline"
                    size={15}
                    color="#4E7364"
                  />
                  <Text style={styles.replyBarText} numberOfLines={1}>
                    Ответ для {shortName(replyTo.author)}: {replyTo.body}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setReplyTo(null)}
                  >
                    <Ionicons name="close" size={18} color="#96AC9E" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputCapsule}>
                <TextInput
                  placeholder={replyTo ? "Ваш ответ…" : "Написать комментарий…"}
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  editable={!sending}
                />

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    sending && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sendButtonText}>
                    {sending ? "…" : "→"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
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
    paddingBottom: 30,
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

  typeChipDone: {
    backgroundColor: "#F3F4F4",
  },

  typeChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  typeChipTextOffer: {
    color: "#A87A2A",
  },

  typeChipTextDone: {
    color: "#6B7570",
  },

  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },

  categoryChip: {
    alignSelf: "flex-start",
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

  dateText: {
    fontSize: 11.5,
    color: "#96AC9E",
  },

  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: "#F3F4F4",
    borderWidth: 0.75,
    borderColor: "#D7DCD9",
    padding: 12,
  },

  statusBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: "#6B7570",
  },

  statusBannerBlocked: {
    backgroundColor: "rgba(192,91,77,0.08)",
    borderColor: "rgba(192,91,77,0.25)",
  },

  statusBannerTextBlocked: {
    color: "#A2543F",
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
    marginTop: 12,
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

  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    backgroundColor: "#F4FAF4",
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  statusButtonReopen: {
    backgroundColor: "rgba(105,183,141,0.10)",
  },

  statusButtonArmed: {
    borderColor: "rgba(192,91,77,0.4)",
    backgroundColor: "rgba(192,91,77,0.07)",
  },

  statusButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#4E7364",
  },

  statusButtonTextArmed: {
    color: "#A2543F",
  },

  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 0.75,
    borderTopColor: "rgba(93,140,120,0.18)",
  },

  commentsTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 18,
    color: "#3F6B5B",
  },

  commentsCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#96AC9E",
  },

  hiddenTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#F4FAF4",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
  },

  hiddenTagText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#719686",
  },

  noComments: {
    fontSize: 13,
    color: "#96AC9E",
    marginTop: 14,
  },

  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 14,
  },

  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: "#EAF4EE",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  commentBubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    backgroundColor: "#F7FAF7",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  commentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  commentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  commentTime: {
    fontSize: 10.5,
    color: "#96AC9E",
  },

  replyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "rgba(105,183,141,0.10)",
  },

  replyTagText: {
    flex: 1,
    fontSize: 11.5,
    color: "#719686",
  },

  commentBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#2F4A3C",
    marginTop: 5,
  },

  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 7,
  },

  commentActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5D8C78",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  commentDeleteText: {
    color: "#96AC9E",
  },

  commentDeleteArmed: {
    color: "#C05B4D",
  },

  actionErrorText: {
    fontSize: 12.5,
    color: "#C05B4D",
    textAlign: "center",
    marginTop: 14,
  },

  inputDock: {
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },

  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#F4FAF4",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },

  replyBarText: {
    flex: 1,
    fontSize: 12,
    color: "#4E7364",
  },

  inputCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 7,
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: "transparent",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#2F4A3C",
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(105,183,141,0.92)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    shadowColor: "#69B78D",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  sendButtonDisabled: {
    opacity: 0.6,
  },

  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
});
