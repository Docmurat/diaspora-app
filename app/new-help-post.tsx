// Новый пост на Стене помощи (Веха 52, вложения — Веха 55).
// Тип (Вопрос/Предложение) → категория → текст → вложения: до 10 фото
// и до 10 файлов (лимиты — в helpService, общие с сервисом).
// В чувствительных категориях (Медицина, Юриспруденция) появляется
// скрытый блок: текст + такие же вложения (10 фото + 10 файлов),
// видимые только автору, модераторам и подтверждённым специалистам.
// Подтверждения и ошибки — экранные (Alert с «Да/Нет» в браузере
// не работает — правило проекта).

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
  HELP_CATEGORIES,
  HelpPostType,
  MAX_FILES_PER_BLOCK,
  MAX_FILE_MB,
  MAX_PHOTOS_PER_BLOCK,
  NewHelpFile,
  SENSITIVE_CATEGORIES,
  checkHelpFileLimits,
  createHelpPost,
} from "../services/helpService";

// Размер файла человеческим языком: «2,4 МБ» / «310 КБ».
function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

// Фото перед отправкой ужимаем до 1600 px — правило вложений (Веха 49).
async function preparePhoto(asset: {
  uri: string;
  width?: number;
  height?: number;
}): Promise<{ uri: string; name: string; mimeType: string }> {
  const tooBig = (asset.width || 0) > 1600;

  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    tooBig ? [{ resize: { width: 1600 } }] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  return {
    uri: result.uri,
    name: `photo-${Date.now()}.jpg`,
    mimeType: "image/jpeg",
  };
}

type PickedFile = NewHelpFile & { isImage: boolean };

export default function NewHelpPostScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [postType, setPostType] = useState<HelpPostType | null>(null);
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  // Скрытый блок включается галочкой (только в чувствительных
  // категориях). Вместе с ним АВТОМАТИЧЕСКИ скрываются комментарии —
  // обсуждение видят и ведут только автор, модераторы и подтверждённые
  // специалисты категории (решение владельца).
  const [hiddenEnabled, setHiddenEnabled] = useState(false);
  const [hiddenBody, setHiddenBody] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSensitive = SENSITIVE_CATEGORIES.includes(category);

  const openPhotos = files.filter((f) => !f.isHidden && f.isImage);
  const openDocs = files.filter((f) => !f.isHidden && !f.isImage);
  const hiddenPhotos = files.filter((f) => f.isHidden && f.isImage);
  const hiddenDocs = files.filter((f) => f.isHidden && !f.isImage);
  const hiddenFiles = files.filter((f) => f.isHidden);

  // Галочка скрытого блока стоит, а сам блок пуст (ни текста, ни
  // файлов) — публиковать нельзя: либо наполнить, либо снять галочку.
  const hiddenBlockEmpty =
    isSensitive &&
    hiddenEnabled &&
    !hiddenBody.trim() &&
    hiddenFiles.length === 0;

  const canSubmit =
    !!postType &&
    !!category &&
    body.trim().length > 0 &&
    !hiddenBlockEmpty &&
    !submitting;

  // Фото: можно выбрать сразу несколько; лишние сверх лимита отрезаем
  // и говорим об этом.
  const pickPhoto = async (isHidden: boolean) => {
    setError("");

    const current = (isHidden ? hiddenPhotos : openPhotos).length;
    const room = MAX_PHOTOS_PER_BLOCK - current;

    if (room <= 0) {
      setError(
        `${isHidden ? "В скрытом блоке" : "Фото"} — не больше ${MAX_PHOTOS_PER_BLOCK} фото`,
      );
      return;
    }

    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: room,
      });

      if (picked.canceled || !picked.assets?.length) return;

      const assets = picked.assets.slice(0, room);
      const prepared: PickedFile[] = [];

      for (const asset of assets) {
        const photo = await preparePhoto(asset);
        prepared.push({
          uri: photo.uri,
          name: photo.name,
          mimeType: photo.mimeType,
          size: null,
          isHidden,
          isImage: true,
        });
      }

      setFiles((prev) => [...prev, ...prepared]);

      if (picked.assets.length > room) {
        setError(
          `Добавлено ${room} из ${picked.assets.length}: не больше ${MAX_PHOTOS_PER_BLOCK} фото в блоке`,
        );
      }
    } catch (e) {
      console.log("Фото не выбралось:", e);
      setError("Не удалось добавить фото, попробуйте ещё раз");
    }
  };

  // Файлы (документы): тоже несколько за раз. Картинка, выбранная как
  // «файл», считается фото — уходит в коллаж, но лимит у неё фотографий.
  const pickDocument = async (isHidden: boolean) => {
    setError("");

    const current = (isHidden ? hiddenDocs : openDocs).length;
    const room = MAX_FILES_PER_BLOCK - current;

    if (room <= 0) {
      setError(
        `${isHidden ? "В скрытом блоке" : "Файлов"} — не больше ${MAX_FILES_PER_BLOCK}`,
      );
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (picked.canceled || !picked.assets?.length) return;

      const accepted: PickedFile[] = [];
      let skippedBig = 0;
      let skippedLimit = 0;

      for (const asset of picked.assets) {
        if (asset.size && asset.size > MAX_FILE_MB * 1024 * 1024) {
          skippedBig += 1;
          continue;
        }
        const isImage = (asset.mimeType || "").startsWith("image/");
        if (!isImage && accepted.filter((a) => !a.isImage).length >= room) {
          skippedLimit += 1;
          continue;
        }
        accepted.push({
          uri: asset.uri,
          name: asset.name || `file-${Date.now()}`,
          mimeType: asset.mimeType || "application/octet-stream",
          size: asset.size ?? null,
          isHidden,
          isImage,
        });
      }

      setFiles((prev) => [...prev, ...accepted]);

      if (skippedBig > 0) {
        setError(`Пропущено ${skippedBig}: файл больше ${MAX_FILE_MB} МБ`);
      } else if (skippedLimit > 0) {
        setError(
          `Пропущено ${skippedLimit}: не больше ${MAX_FILES_PER_BLOCK} файлов в блоке`,
        );
      }
    } catch (e) {
      console.log("Файл не выбрался:", e);
      setError("Не удалось добавить файл, попробуйте ещё раз");
    }
  };

  const removeFile = (uri: string) => {
    setFiles((prev) => prev.filter((f) => f.uri !== uri));
  };

  const chooseCategory = (next: string) => {
    setCategory(next);
    setError("");

    // Ушли из чувствительной категории — скрытый блок теряет смысл,
    // тихо вычищаем его содержимое, чтобы не уехало в базу.
    if (!SENSITIVE_CATEGORIES.includes(next)) {
      setHiddenEnabled(false);
      setHiddenBody("");
      setFiles((prev) => prev.filter((f) => !f.isHidden));
    }
  };

  const toggleHiddenBlock = () => {
    setError("");

    if (hiddenEnabled) {
      // Галочку сняли — содержимое блока вычищаем, чтобы не уехало.
      setHiddenEnabled(false);
      setHiddenBody("");
      setFiles((prev) => prev.filter((f) => !f.isHidden));
    } else {
      setHiddenEnabled(true);
    }
  };

  const submit = async () => {
    if (!canSubmit || !postType) return;

    const limitError = checkHelpFileLimits(
      files.map(({ isImage, ...file }) => file),
    );
    if (limitError) {
      setError(limitError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { failedFiles } = await createHelpPost({
        category,
        postType,
        body,
        hiddenBody: isSensitive && hiddenEnabled ? hiddenBody : "",
        // Есть скрытый блок → обсуждение автоматически только для
        // допущенных (галочка одна, решение владельца).
        commentsHidden: isSensitive && hiddenEnabled,
        files:
          isSensitive && hiddenEnabled
            ? files.map(({ isImage, ...file }) => file)
            : files
                .filter((f) => !f.isHidden)
                .map(({ isImage, ...file }) => file),
      });

      if (failedFiles.length > 0) {
        console.log("Не загрузились файлы:", failedFiles.join(", "));
      }

      router.back();
    } catch (e: any) {
      console.log("Пост не создался:", e);
      setError(e?.message || "Не удалось опубликовать пост");
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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

        <Text style={styles.headerTitle}>Новый пост</Text>

        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Тип поста */}
        <Text style={styles.label}>Что это? *</Text>

        <View style={styles.typeRow}>
          {(
            [
              ["question", "Вопрос", "Прошу совета или помощи"],
              ["offer", "Предложение", "Готов(а) помочь или поделиться"],
            ] as const
          ).map(([value, title, hint]) => {
            const active = postType === value;

            return (
              <TouchableOpacity
                key={value}
                style={[styles.typeCard, active && styles.typeCardActive]}
                activeOpacity={0.8}
                onPress={() => setPostType(value)}
              >
                <Text
                  style={[
                    styles.typeCardTitle,
                    active && styles.typeCardTitleActive,
                  ]}
                >
                  {title}
                </Text>
                <Text
                  style={[
                    styles.typeCardHint,
                    active && styles.typeCardHintActive,
                  ]}
                >
                  {hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Категория */}
        <Text style={styles.label}>Категория *</Text>

        <View style={styles.chipsWrap}>
          {HELP_CATEGORIES.map((item) => {
            const active = category === item;

            return (
              <TouchableOpacity
                key={item}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.75}
                onPress={() => chooseCategory(item)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Текст */}
        <Text style={styles.label}>Текст поста *</Text>

        <TextInput
          style={styles.bodyInput}
          multiline
          placeholder="Опишите вопрос или предложение…"
          placeholderTextColor="#8FA79A"
          value={body}
          onChangeText={(v) => {
            setBody(v);
            setError("");
          }}
        />

        {/* Открытые вложения: фото коллажем, файлы строками (Веха 55) */}
        <View style={styles.labelRow}>
          <Text style={styles.label}>Фото (видны всем)</Text>
          <Text style={styles.counter}>
            {openPhotos.length} / {MAX_PHOTOS_PER_BLOCK}
          </Text>
        </View>

        <View style={styles.filesRow}>
          {openPhotos.map((file) => (
            <View key={file.uri} style={styles.photoWrap}>
              <Image source={{ uri: file.uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => removeFile(file.uri)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}

          {openPhotos.length < MAX_PHOTOS_PER_BLOCK && (
            <TouchableOpacity
              style={styles.addTile}
              activeOpacity={0.75}
              onPress={() => pickPhoto(false)}
            >
              <Ionicons name="image-outline" size={22} color="#719686" />
              <Text style={styles.addTileText}>Фото</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Файлы (видны всем)</Text>
          <Text style={styles.counter}>
            {openDocs.length} / {MAX_FILES_PER_BLOCK}
          </Text>
        </View>

        {openDocs.map((file) => (
          <View key={file.uri} style={styles.docRow}>
            <Ionicons name="document-text-outline" size={18} color="#4E7364" />
            <Text style={styles.docRowName} numberOfLines={1}>
              {file.name}
            </Text>
            {!!file.size && (
              <Text style={styles.docRowSize}>{formatSize(file.size)}</Text>
            )}
            <TouchableOpacity
              onPress={() => removeFile(file.uri)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#96AC9E" />
            </TouchableOpacity>
          </View>
        ))}

        {openDocs.length < MAX_FILES_PER_BLOCK && (
          <TouchableOpacity
            style={styles.addDocButton}
            activeOpacity={0.75}
            onPress={() => pickDocument(false)}
          >
            <Ionicons name="attach-outline" size={16} color="#3F6B5B" />
            <Text style={styles.hiddenAddText}>Добавить файл</Text>
            <Text style={styles.addDocHint}>до {MAX_FILE_MB} МБ</Text>
          </TouchableOpacity>
        )}

        {/* Скрытый блок — только в чувствительных категориях.
            Снаружи — галочка с пояснением; включили — раскрывается
            ввод. Вместе с блоком автоматически скрываются комментарии. */}
        {isSensitive && (
          <TouchableOpacity
            style={styles.hiddenToggle}
            activeOpacity={0.75}
            onPress={toggleHiddenBlock}
          >
            <Ionicons
              name={hiddenEnabled ? "checkbox" : "square-outline"}
              size={20}
              color={hiddenEnabled ? "#69B78D" : "#8FA79A"}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.hiddenToggleTitle}>
                Добавить скрытый блок
              </Text>
              <Text style={styles.hiddenToggleHint}>
                Этот блок увидят только вы, модераторы и подтверждённые
                специалисты категории «{category}». Сюда можно поместить
                личные данные, документы и снимки.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isSensitive && hiddenEnabled && (
          <View style={styles.hiddenBlock}>
            <View style={styles.hiddenHeader}>
              <Ionicons name="lock-closed" size={15} color="#3F6B5B" />
              <Text style={styles.hiddenTitle}>Скрытый материал</Text>
            </View>

            <Text style={styles.hiddenHint}>
              Комментарии под постом тоже будут скрыты: видеть текст блока
              и участвовать в обсуждении смогут только вы и подтверждённые
              специалисты категории «{category}».
            </Text>

            <TextInput
              style={styles.hiddenInput}
              multiline
              placeholder="Скрытый текст (не обязательно)…"
              placeholderTextColor="#8FA79A"
              value={hiddenBody}
              onChangeText={setHiddenBody}
            />

            <View style={styles.labelRow}>
              <Text style={styles.hiddenSubLabel}>Фото</Text>
              <Text style={styles.counter}>
                {hiddenPhotos.length} / {MAX_PHOTOS_PER_BLOCK}
              </Text>
            </View>

            <View style={styles.filesRow}>
              {hiddenPhotos.map((file) => (
                <View key={file.uri} style={styles.photoWrap}>
                  <Image source={{ uri: file.uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removeFile(file.uri)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {hiddenPhotos.length < MAX_PHOTOS_PER_BLOCK && (
                <TouchableOpacity
                  style={styles.addTile}
                  activeOpacity={0.75}
                  onPress={() => pickPhoto(true)}
                >
                  <Ionicons name="image-outline" size={22} color="#719686" />
                  <Text style={styles.addTileText}>Фото</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.hiddenSubLabel}>Файлы</Text>
              <Text style={styles.counter}>
                {hiddenDocs.length} / {MAX_FILES_PER_BLOCK}
              </Text>
            </View>

            {hiddenDocs.map((file) => (
              <View key={file.uri} style={styles.docRow}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#4E7364"
                />
                <Text style={styles.docRowName} numberOfLines={1}>
                  {file.name}
                </Text>
                {!!file.size && (
                  <Text style={styles.docRowSize}>{formatSize(file.size)}</Text>
                )}
                <TouchableOpacity
                  onPress={() => removeFile(file.uri)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color="#96AC9E" />
                </TouchableOpacity>
              </View>
            ))}

            {hiddenDocs.length < MAX_FILES_PER_BLOCK && (
              <TouchableOpacity
                style={styles.addDocButton}
                activeOpacity={0.75}
                onPress={() => pickDocument(true)}
              >
                <Ionicons name="attach-outline" size={16} color="#3F6B5B" />
                <Text style={styles.hiddenAddText}>Добавить файл</Text>
                <Text style={styles.addDocHint}>до {MAX_FILE_MB} МБ</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {hiddenBlockEmpty && (
          <Text style={styles.hiddenEmptyHint}>
            Скрытый блок пуст: добавьте в него текст, фото или файл — либо
            снимите галочку «Добавить скрытый блок»
          </Text>
        )}

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitText}>Опубликовать</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.requiredHint}>
          Поля со звёздочкой (*) обязательны
        </Text>
      </ScrollView>
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
    paddingBottom: 60,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4E7364",
    marginTop: 18,
    marginBottom: 8,
  },

  typeRow: {
    flexDirection: "row",
    gap: 10,
  },

  typeCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  typeCardActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(105,183,141,0.92)",
  },

  typeCardTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  typeCardTitleActive: {
    color: "#FFFFFF",
  },

  typeCardHint: {
    fontSize: 11.5,
    lineHeight: 15,
    color: "#7E988B",
    marginTop: 3,
  },

  typeCardHintActive: {
    color: "rgba(255,255,255,0.9)",
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

  bodyInput: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
    textAlignVertical: "top",
  },

  filesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  photoWrap: {
    width: 76,
    height: 76,
  },

  photo: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: "#EAF4EE",
  },

  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#C05B4D",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  addTile: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 0.75,
    borderStyle: "dashed",
    borderColor: "rgba(93,140,120,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  addTileText: {
    fontSize: 11,
    color: "#719686",
  },

  hiddenBlock: {
    marginTop: 12,
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

  hiddenHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#4E7364",
    marginTop: 6,
    marginBottom: 10,
  },

  hiddenInput: {
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
    textAlignVertical: "top",
    marginBottom: 10,
  },

  // Кнопка «Добавить файл» — общая для открытого и скрытого блоков.
  addDocButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    marginTop: 4,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  addDocHint: {
    fontSize: 11,
    color: "#8FA79A",
    marginLeft: 2,
  },

  // Подпись + счётчик «3 / 10» в одну строку.
  labelRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  counter: {
    fontSize: 12,
    color: "#96AC9E",
    marginBottom: 8,
  },

  hiddenSubLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#4E7364",
    marginTop: 4,
    marginBottom: 8,
  },

  // Строка файла с именем, размером и крестиком.
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
    marginBottom: 8,
  },

  docRowName: {
    flex: 1,
    fontSize: 13,
    color: "#4E7364",
  },

  docRowSize: {
    fontSize: 11.5,
    color: "#96AC9E",
  },

  hiddenAddText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  // Галочка «Добавить скрытый блок» — снаружи, до раскрытия блока.
  hiddenToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 20,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  hiddenToggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  hiddenToggleHint: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7E988B",
    marginTop: 2,
  },

  errorText: {
    fontSize: 13,
    color: "#C05B4D",
    textAlign: "center",
    marginTop: 16,
  },

  submitButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(105,183,141,0.92)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    shadowColor: "#69B78D",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  submitDisabled: {
    opacity: 0.7,
  },

  submitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  hiddenEmptyHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#E0A33E",
    textAlign: "center",
    marginTop: 14,
    paddingHorizontal: 10,
  },

  requiredHint: {
    fontSize: 12,
    color: "#8FA79A",
    textAlign: "center",
    marginTop: 12,
  },
});
