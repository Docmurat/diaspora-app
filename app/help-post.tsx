// Экран поста Стены помощи (Веха 53; вложения и просмотрщик — Веха 55).
// Сюда ведут карточки ленты и ссылки из уведомлений (/help-post?id=…).
// Показывает: пост целиком (автор, чипы, текст, фото, скрытый блок или
// плашку), обсуждение — комментарии с ответами в один уровень (как в
// Threads), поле ввода, закрытие поста в архив и возврат из архива.
// Скрытое обсуждение (comments_hidden): ленту видят и пишут только
// автор поста и подтверждённые специалисты категории — правила базы
// сами не отдают лишнего, экран лишь показывает плашку остальным.
// Удалить комментарий может его автор и автор поста; подтверждение —
// вторым нажатием (системное окошко в браузере не работает).
// Вложения (Веха 55): фото — коллажем небольших квадратов (3 в ряд),
// нажатие открывает просмотрщик на весь экран (листать, счётчик,
// крестик; на компьютере — стрелки и клавиши ← → Esc); файлы — строкой
// с именем и размером, нажатие скачивает.

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
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HelpAttachmentItem,
  HelpCommentItem,
  HelpPostDetails,
  POST_TYPE_LABELS,
  addHelpComment,
  archiveHelpPostByModerator,
  authorProfileParams,
  blockHelpPost,
  canJoinHiddenDiscussion,
  closeHelpPost,
  deleteHelpComment,
  deleteHelpPost,
  getHelpComments,
  getHelpPost,
  isHelpModerator,
  markHelpPostNotificationsRead,
  reopenHelpPost,
  reportHelpPost,
  unblockHelpPost,
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

// Размер файла человеческим языком: «2,4 МБ» / «310 КБ».
function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

// ─────────────────────────────────────────────────────────────────────
// КОЛЛАЖ ФОТО (Веха 55): квадраты по 3 в ряд, размер считается от
// ширины контейнера (onLayout), поэтому на любом экране ряд ровный.
const GRID_COLS = 3;
const GRID_GAP = 6;

function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: HelpAttachmentItem[];
  onOpen: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const tile =
    width > 0
      ? Math.floor((width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS)
      : 0;

  return (
    <View
      style={styles.grid}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {tile > 0 &&
        photos.map((photo, index) => (
          <TouchableOpacity
            key={photo.id}
            activeOpacity={0.85}
            onPress={() => onOpen(index)}
            style={[
              styles.gridTile,
              {
                width: tile,
                height: tile,
                marginRight: (index + 1) % GRID_COLS === 0 ? 0 : GRID_GAP,
              },
            ]}
          >
            <Image
              source={{ uri: photo.signedUrl! }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ПРОСМОТРЩИК на весь экран: тёмный фон, листание свайпом (FlatList с
// постраничной прокруткой), стрелки по бокам (для мыши), счётчик «2 / 7»
// и крестик. На вебе слушаем клавиши ← → Esc.
function PhotoViewer({
  photos,
  startIndex,
  onClose,
}: {
  photos: HelpAttachmentItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<HelpAttachmentItem>>(null);
  const [index, setIndex] = useState(startIndex);
  const indexRef = useRef(startIndex);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(photos.length - 1, next));
      indexRef.current = clamped;
      setIndex(clamped);
      listRef.current?.scrollToOffset({
        offset: clamped * width,
        animated: true,
      });
    },
    [photos.length, width],
  );

  // Клавиатура на компьютере.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goTo(indexRef.current + 1);
      else if (e.key === "ArrowLeft") goTo(indexRef.current - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goTo, onClose]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.viewerBackdrop}>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            indexRef.current = i;
            setIndex(i);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={1}
              onPress={onClose}
              style={{ width, height, justifyContent: "center" }}
            >
              <Image
                source={{ uri: item.signedUrl! }}
                style={{
                  width,
                  height: height - insets.top - insets.bottom - 80,
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        />

        {/* Верхняя полоса: счётчик и крестик */}
        <View style={[styles.viewerTop, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.viewerCounter}>
            {index + 1} / {photos.length}
          </Text>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Стрелки по бокам — удобно мышью; на телефоне не мешают */}
        {photos.length > 1 && index > 0 && (
          <TouchableOpacity
            style={[styles.viewerArrow, styles.viewerArrowLeft]}
            onPress={() => goTo(index - 1)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="chevron-back" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {photos.length > 1 && index < photos.length - 1 && (
          <TouchableOpacity
            style={[styles.viewerArrow, styles.viewerArrowRight]}
            onPress={() => goTo(index + 1)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="chevron-forward" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// Строка файла: имя, размер, значок скачивания. Нажатие — открыть/скачать.
function FileRow({ file }: { file: HelpAttachmentItem }) {
  return (
    <TouchableOpacity
      style={styles.docRow}
      activeOpacity={0.75}
      onPress={() => {
        if (file.signedUrl) Linking.openURL(file.signedUrl);
      }}
    >
      <Ionicons name="document-text-outline" size={18} color="#4E7364" />
      <Text style={styles.docName} numberOfLines={1}>
        {file.fileName || "Файл"}
      </Text>
      {!!file.fileSize && (
        <Text style={styles.docSize}>{formatSize(file.fileSize)}</Text>
      )}
      <Ionicons name="download-outline" size={16} color="#96AC9E" />
    </TouchableOpacity>
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

  // Просмотрщик фото: какой набор (открытые/скрытые) и с какого начать.
  const [viewer, setViewer] = useState<{
    photos: HelpAttachmentItem[];
    index: number;
  } | null>(null);

  // Модерация (Веха 57): меню «⋮» и подтверждение удаления вторым нажатием.
  const [isModerator, setIsModerator] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modBusy, setModBusy] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [blockArmed, setBlockArmed] = useState(false);
  // Причина блокировки — обязательна, автор её увидит (Веха 57).
  const [blockReason, setBlockReason] = useState("");

  useEffect(() => {
    isHelpModerator().then(setIsModerator);
  }, []);

  // Меню есть у всех: модератор, автор, прочие (жалоба на пост).
  const menuAvailable = !!post && (isModerator || post.isMine || !!post.author);

  // Жалоба на пост: небольшая форма под меню.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const handleSendReport = async () => {
    if (!post?.author || reportSending || !reportText.trim()) return;
    setReportSending(true);
    setActionError("");
    try {
      await reportHelpPost(post.id, post.author.id, reportText);
      setReportDone(true);
      setReportText("");
      setReportOpen(false);
      setMenuOpen(false);
    } catch (e: any) {
      console.log("Жалоба не ушла:", e);
      setActionError(e?.message || "Не удалось отправить жалобу.");
    } finally {
      setReportSending(false);
    }
  };

  const runModeration = async (action: () => Promise<void>, goBack = false) => {
    if (!post || modBusy) return;
    setModBusy(true);
    setActionError("");
    try {
      await action();
      setMenuOpen(false);
      setDeleteArmed(false);
      setBlockArmed(false);
      if (goBack) {
        router.back();
      } else {
        await load(true);
      }
    } catch (e: any) {
      console.log("Действие модерации не прошло:", e);
      setActionError(e?.message || "Не удалось выполнить действие.");
    } finally {
      setModBusy(false);
    }
  };

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

  const all = post?.attachments || [];
  const live = all.filter((a) => !a.expired);
  const openPhotos = live.filter(
    (a) => !a.isHidden && a.isImage && a.signedUrl,
  );
  const openFiles = live.filter((a) => !a.isHidden && !a.isImage);
  const hiddenPhotos = live.filter(
    (a) => a.isHidden && a.isImage && a.signedUrl,
  );
  const hiddenFiles = live.filter((a) => a.isHidden && !a.isImage);
  // Срок хранения (90 дней) истёк — вместо вложений пометка (Веха 56).
  const openExpired = all.filter((a) => a.expired && !a.isHidden).length;
  const hiddenExpired = all.filter((a) => a.expired && a.isHidden).length;

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

        {menuAvailable ? (
          <TouchableOpacity
            style={[styles.backButton, { alignItems: "flex-end" }]}
            onPress={() => {
              setMenuOpen((v) => !v);
              setDeleteArmed(false);
              setBlockArmed(false);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Меню поста"
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#3F6B5B" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      {/* Меню «⋮» — раскрывается под шапкой */}
      {menuAvailable && post && menuOpen && (
        <View style={styles.modMenu}>
          {isModerator && (
            <Text style={styles.modMenuTitle}>МОДЕРАЦИЯ ПОСТА</Text>
          )}

          {/* Блокировка — только модераторы */}
          {isModerator &&
            (post.status !== "blocked" ? (
              <>
                <TouchableOpacity
                  style={styles.modMenuItem}
                  disabled={modBusy}
                  onPress={() => {
                    setBlockArmed((v) => !v);
                    setDeleteArmed(false);
                  }}
                >
                  <Ionicons
                    name="hand-left-outline"
                    size={17}
                    color="#3F6B5B"
                  />
                  <Text style={styles.modMenuText}>Заблокировать пост</Text>
                </TouchableOpacity>

                {blockArmed && (
                  <View style={styles.reportBox}>
                    <TextInput
                      style={styles.reportInput}
                      multiline
                      placeholder="Причина блокировки — автор её увидит…"
                      placeholderTextColor="#8FA79A"
                      value={blockReason}
                      onChangeText={setBlockReason}
                      editable={!modBusy}
                    />
                    <View style={styles.reportButtons}>
                      <TouchableOpacity
                        style={[
                          styles.reportSend,
                          styles.reportSendDanger,
                          (!blockReason.trim() || modBusy) && { opacity: 0.6 },
                        ]}
                        disabled={!blockReason.trim() || modBusy}
                        onPress={() =>
                          runModeration(async () => {
                            await blockHelpPost(post.id, blockReason);
                            setBlockReason("");
                          })
                        }
                      >
                        <Text style={styles.reportSendText}>Заблокировать</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setBlockArmed(false);
                          setBlockReason("");
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.reportCancel}>Отмена</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={styles.modMenuItem}
                disabled={modBusy}
                onPress={() => runModeration(() => unblockHelpPost(post.id))}
              >
                <Ionicons name="lock-open-outline" size={17} color="#3F6B5B" />
                <Text style={styles.modMenuText}>Снять блокировку</Text>
              </TouchableOpacity>
            ))}

          {/* Архив: модератор — любой живой пост; автор — свой (и вернуть) */}
          {(isModerator || post.isMine) && post.status === "active" && (
            <TouchableOpacity
              style={styles.modMenuItem}
              disabled={modBusy}
              onPress={() =>
                runModeration(() =>
                  post.isMine
                    ? closeHelpPost(post.id)
                    : archiveHelpPostByModerator(post.id),
                )
              }
            >
              <Ionicons name="archive-outline" size={17} color="#3F6B5B" />
              <Text style={styles.modMenuText}>Убрать в архив</Text>
            </TouchableOpacity>
          )}

          {post.isMine && post.status === "archived" && (
            <TouchableOpacity
              style={styles.modMenuItem}
              disabled={modBusy}
              onPress={() => runModeration(() => reopenHelpPost(post.id))}
            >
              <Ionicons name="refresh-outline" size={17} color="#3F6B5B" />
              <Text style={styles.modMenuText}>Вернуть из архива</Text>
            </TouchableOpacity>
          )}

          {/* Удалить — модератор или автор */}
          {(isModerator || post.isMine) && (
            <TouchableOpacity
              style={styles.modMenuItem}
              disabled={modBusy}
              onPress={() => {
                if (!deleteArmed) {
                  setDeleteArmed(true);
                  setBlockArmed(false);
                  return;
                }
                runModeration(() => deleteHelpPost(post.id), true);
              }}
            >
              <Ionicons
                name="trash-outline"
                size={17}
                color={deleteArmed ? "#C05B4D" : "#3F6B5B"}
              />
              <Text
                style={[
                  styles.modMenuText,
                  deleteArmed && styles.modMenuTextDanger,
                ]}
              >
                {deleteArmed
                  ? "Точно удалить насовсем? Нажмите ещё раз"
                  : "Удалить пост"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Пожаловаться на пост — участники (не автор, не модераторы) */}
          {!post.isMine && !isModerator && !!post.author && (
            <TouchableOpacity
              style={styles.modMenuItem}
              onPress={() => setReportOpen((v) => !v)}
            >
              <Ionicons
                name="flag-outline"
                size={17}
                color={reportDone ? "#96AC9E" : "#3F6B5B"}
              />
              <Text
                style={[styles.modMenuText, reportDone && { color: "#96AC9E" }]}
              >
                {reportDone ? "Жалоба отправлена" : "Пожаловаться на пост"}
              </Text>
            </TouchableOpacity>
          )}

          {reportOpen && !reportDone && (
            <View style={styles.reportBox}>
              <TextInput
                style={styles.reportInput}
                multiline
                placeholder="Что не так с этим постом?"
                placeholderTextColor="#8FA79A"
                value={reportText}
                onChangeText={setReportText}
                editable={!reportSending}
              />
              <View style={styles.reportButtons}>
                <TouchableOpacity
                  style={[
                    styles.reportSend,
                    (!reportText.trim() || reportSending) && { opacity: 0.6 },
                  ]}
                  disabled={!reportText.trim() || reportSending}
                  onPress={handleSendReport}
                >
                  <Text style={styles.reportSendText}>
                    {reportSending ? "Отправка…" : "Отправить жалобу"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setReportOpen(false);
                    setReportText("");
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.reportCancel}>Отмена</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modMenuHint}>
                Жалобу увидят модераторы. Автору о ней не сообщается.
              </Text>
            </View>
          )}

          {modBusy && (
            <ActivityIndicator
              size="small"
              color="#69B78D"
              style={{ marginTop: 6 }}
            />
          )}

          {isModerator && (
            <Text style={styles.modMenuHint}>
              Блокировка: пост и обсуждение видят только автор и модераторы,
              автору приходит уведомление с причиной. Удаление — насовсем, в
              архив не попадает.
            </Text>
          )}
          {!isModerator && post.isMine && (
            <Text style={styles.modMenuHint}>
              Удалить — значит стереть насовсем вместе с комментариями, в архив
              такой пост не попадает. Хотите сохранить пост читаемым — выберите
              «Убрать в архив».
            </Text>
          )}
        </View>
      )}

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
                  {post.isMine
                    ? "Пост заблокирован модерацией и виден только вам."
                    : "Пост заблокирован модерацией: виден только автору и модераторам."}
                  {!!post.blockedReason && (
                    <Text style={styles.statusBannerReason}>
                      {"\n"}Причина: {post.blockedReason}
                    </Text>
                  )}
                </Text>
              </View>
            )}

            <Text style={styles.body}>{post.body}</Text>

            {openPhotos.length > 0 && (
              <PhotoGrid
                photos={openPhotos}
                onOpen={(index) => setViewer({ photos: openPhotos, index })}
              />
            )}

            {openFiles.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}

            {openExpired > 0 && (
              <View style={styles.expiredRow}>
                <Ionicons name="time-outline" size={15} color="#96AC9E" />
                <Text style={styles.expiredText}>
                  Срок хранения вложений истёк ({openExpired}) — файлы хранятся
                  90 дней.
                </Text>
              </View>
            )}

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

                {hiddenPhotos.length > 0 && (
                  <PhotoGrid
                    photos={hiddenPhotos}
                    onOpen={(index) =>
                      setViewer({ photos: hiddenPhotos, index })
                    }
                  />
                )}

                {hiddenFiles.map((file) => (
                  <FileRow key={file.id} file={file} />
                ))}

                {hiddenExpired > 0 && (
                  <View style={styles.expiredRow}>
                    <Ionicons name="time-outline" size={15} color="#96AC9E" />
                    <Text style={styles.expiredText}>
                      Срок хранения вложений истёк ({hiddenExpired}) — файлы
                      хранятся 90 дней.
                    </Text>
                  </View>
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

      {viewer && (
        <PhotoViewer
          photos={viewer.photos}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
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

  // Меню модерации (Веха 57)
  modMenu: {
    marginHorizontal: 20,
    marginBottom: 6,
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#F4FAF4",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  modMenuTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#719686",
    marginBottom: 4,
  },

  modMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  modMenuText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  modMenuTextDanger: {
    color: "#C05B4D",
  },

  reportBox: {
    marginTop: 8,
  },

  reportInput: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#2F4A3C",
    textAlignVertical: "top",
  },

  reportButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },

  reportSend: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(105,183,141,0.92)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  reportSendDanger: {
    backgroundColor: "#C05B4D",
  },

  appealButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    backgroundColor: "#FFFFFF",
    paddingVertical: 11,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  appealButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  reportSendText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  reportCancel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#96AC9E",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  modMenuHint: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#7E988B",
    marginTop: 8,
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

  statusBannerReason: {
    fontWeight: "600",
    color: "#A2543F",
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

  // Коллаж фото (Веха 55)
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },

  gridTile: {
    marginBottom: GRID_GAP,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EAF4EE",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  gridImage: {
    width: "100%",
    height: "100%",
  },

  // Просмотрщик
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    justifyContent: "center",
  },

  viewerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  viewerCounter: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },

  viewerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  viewerArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  viewerArrowLeft: {
    left: 12,
  },

  viewerArrowRight: {
    right: 12,
  },

  docSize: {
    fontSize: 11.5,
    color: "#96AC9E",
  },

  expiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },

  expiredText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#96AC9E",
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
