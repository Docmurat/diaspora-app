// Новый пост на Стене помощи (Веха 52).
// Тип (Вопрос/Предложение) → категория → текст → фото (до 3).
// В чувствительных категориях (Медицина, Юриспруденция) появляется
// скрытый блок: текст + файлы, видимые только автору, модераторам и
// подтверждённым специалистам категории.
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
  NewHelpFile,
  SENSITIVE_CATEGORIES,
  createHelpPost,
} from "../services/helpService";

const MAX_OPEN_PHOTOS = 3;
const MAX_HIDDEN_FILES = 5;
const MAX_FILE_MB = 15;

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

  const openPhotos = files.filter((f) => !f.isHidden);
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

  const pickPhoto = async (isHidden: boolean) => {
    setError("");

    const limit = isHidden ? MAX_HIDDEN_FILES : MAX_OPEN_PHOTOS;
    const current = isHidden ? hiddenFiles.length : openPhotos.length;

    if (current >= limit) {
      setError(
        isHidden
          ? `В скрытом блоке — не больше ${MAX_HIDDEN_FILES} файлов`
          : `Фото — не больше ${MAX_OPEN_PHOTOS}`,
      );
      return;
    }

    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (picked.canceled || !picked.assets?.[0]) return;

      const prepared = await preparePhoto(picked.assets[0]);

      setFiles((prev) => [
        ...prev,
        {
          uri: prepared.uri,
          name: prepared.name,
          mimeType: prepared.mimeType,
          size: null,
          isHidden,
          isImage: true,
        },
      ]);
    } catch (e) {
      console.log("Фото не выбралось:", e);
      setError("Не удалось добавить фото, попробуйте ещё раз");
    }
  };

  const pickDocument = async () => {
    setError("");

    if (hiddenFiles.length >= MAX_HIDDEN_FILES) {
      setError(`В скрытом блоке — не больше ${MAX_HIDDEN_FILES} файлов`);
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];

      if (asset.size && asset.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Файл больше ${MAX_FILE_MB} МБ — выберите поменьше`);
        return;
      }

      setFiles((prev) => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.name || `file-${Date.now()}`,
          mimeType: asset.mimeType || "application/octet-stream",
          size: asset.size ?? null,
          isHidden: true,
          isImage: (asset.mimeType || "").startsWith("image/"),
        },
      ]);
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

        {/* Открытые фото */}
        <Text style={styles.label}>Фото (видны всем)</Text>

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

          {openPhotos.length < MAX_OPEN_PHOTOS && (
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

            <View style={styles.filesRow}>
              {hiddenFiles.map((file) =>
                file.isImage ? (
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
                ) : (
                  <View key={file.uri} style={styles.docTile}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#4E7364"
                    />
                    <Text style={styles.docName} numberOfLines={2}>
                      {file.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removeFile(file.uri)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ),
              )}
            </View>

            {hiddenFiles.length < MAX_HIDDEN_FILES && (
              <View style={styles.hiddenButtonsRow}>
                <TouchableOpacity
                  style={styles.hiddenAddButton}
                  activeOpacity={0.75}
                  onPress={() => pickPhoto(true)}
                >
                  <Ionicons name="image-outline" size={16} color="#3F6B5B" />
                  <Text style={styles.hiddenAddText}>Фото</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hiddenAddButton}
                  activeOpacity={0.75}
                  onPress={pickDocument}
                >
                  <Ionicons
                    name="attach-outline"
                    size={16}
                    color="#3F6B5B"
                  />
                  <Text style={styles.hiddenAddText}>Файл</Text>
                </TouchableOpacity>
              </View>
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

  hiddenButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  hiddenAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
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

  docTile: {
    width: 110,
    height: 76,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    backgroundColor: "#FFFFFF",
    padding: 8,
    gap: 4,
  },

  docName: {
    fontSize: 10.5,
    lineHeight: 13,
    color: "#4E7364",
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
