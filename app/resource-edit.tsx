// «Новый ресурс» / «Изменить ресурс» (Веха 71). Экран основателя и
// модераторов: картинка (по желанию, с кадрированием — то же окно,
// что у фото профиля, но рамка квадратная), название, описание, ссылка. Без параметра id — новая
// карточка, с id — правка и удаление.
//
// Удаление — ВТОРЫМ нажатием (правило проекта: Alert «Да/Нет» в
// браузере не работает). Замок прав стоит на сервере (правила таблицы
// resources); экран только прячет лишнее.
//
// Раздел служебный (как модерация) — строки по-русски на всех языках.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AvatarCropModal, { prepareAvatarSource } from "../components/AvatarCrop";
import { Glass, Tekmet } from "../components/mingi";
import { t, useLanguage } from "../services/i18nService";
import {
  canManageResources,
  createResource,
  deleteResource,
  getResource,
  isWideImage,
  normalizeUrl,
  RESOURCE_DESCRIPTION_MAX,
  RESOURCE_TITLE_MAX,
  updateResource,
} from "../services/resourcesService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function ResourceEditScreen() {
  const lang = useLanguage(); // перерисовка при смене языка
  const insets = useSafeAreaInsets(); // «Назад» на одном уровне со всеми экранами
  const params = useLocalSearchParams<{ id?: string }>();
  const resourceId = typeof params.id === "string" ? params.id : "";
  const isEdit = !!resourceId;

  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  // Картинка: адрес с сервера (уже сохранённая), локальный файл после
  // кадрирования (новая) или пусто (без картинки).
  const [image, setImage] = useState("");
  // Форма картинки: квадрат или широкая 3:1 (горизонтальный логотип).
  const [imageWide, setImageWide] = useState(false);
  const [cropVisible, setCropVisible] = useState(false);
  const [cropSource, setCropSource] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const ok = await canManageResources();
        if (!alive) return;
        setAllowed(ok);

        if (ok && resourceId) {
          const item = await getResource(resourceId);
          if (!alive) return;

          if (item) {
            setTitle(item.title);
            setDescription(item.description);
            setUrl(item.url);
            setImage(item.image_url || "");
            setImageWide(isWideImage(item.image_url));
          } else {
            setError("Ресурс не найден — возможно, его уже удалили");
          }
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить");
        }
      } finally {
        if (alive) setReady(true);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [resourceId]);

  const formValid = !!title.trim() && !!description.trim() && !!url.trim();

  // Выбор картинки из галереи → сразу окно кадрирования (как у фото
  // профиля в edit-profile).
  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(t("register.gallery.text"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];

      // Сразу уменьшаем, чтобы не держать в памяти тяжёлый оригинал.
      const prepared = await prepareAvatarSource(
        asset.uri,
        asset.width || 0,
        asset.height || 0,
      );

      setCropSource(prepared);
      setCropVisible(true);
    }
  };

  const handleSave = async () => {
    if (!formValid) {
      setError(t("feedback.error.fill"));
      return;
    }

    if (!normalizeUrl(url)) {
      setError("Проверьте ссылку: нужен адрес сайта, например site.ru");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (isEdit) {
        await updateResource(resourceId, {
          title,
          description,
          url,
          image,
          imageWide,
        });
      } else {
        await createResource({
          title,
          description,
          url,
          image,
          imageWide,
        });
      }

      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось сохранить";
      setError(msg);
      Alert.alert(t("common.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    // Первое нажатие «взводит» кнопку, второе — удаляет.
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }

    try {
      setSaving(true);
      setError("");
      await deleteResource(resourceId);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось удалить";
      setError(msg);
      Alert.alert(t("common.error"), msg);
      setDeleteArmed(false);
    } finally {
      setSaving(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (!ready) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#69B78D" />
        </View>
      </View>
    );
  }

  const backLink = Platform.OS === "web" && (
    <TouchableOpacity
      onPress={() => router.back()}
      activeOpacity={0.8}
      style={[styles.backLink, { top: insets.top + 10 }]}
    >
      <Text style={styles.backLinkText}>{t("common.backArrow")}</Text>
    </TouchableOpacity>
  );

  // Обычный участник сюда не попадает (кнопок у него нет), но адрес
  // можно набрать руками — показываем вежливый отказ.
  if (!allowed) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        {backLink}

        <View style={styles.loaderWrap}>
          <Tekmet style={styles.tekmet} />
          <Text style={styles.text}>
            Вести список ресурсов могут только основатель и модераторы.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      {backLink}

      {/* Образец Вехи 69: центрированная форма, прокрутка сама следит
          за клавиатурой, тап по пустому месту её прячет. */}
      <KeyboardAwareScrollView
        style={styles.keyboardWrap}
        contentContainerStyle={styles.container}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {isEdit ? "Изменить ресурс" : "Новый ресурс"}
        </Text>
        <Text style={styles.subtitle}>{t("common.brandCaps")}</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          Карточка появится в разделе «Знания → Ресурсы» у всех участников.
        </Text>

        {/* Картинка карточки — по желанию. Нажатие открывает галерею,
            затем окно кадрирования (квадрат). */}
        <View style={styles.imageBlock}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePickImage}
            style={[
              styles.imageBox,
              !!image && imageWide && styles.imageBoxWide,
            ]}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={
                  imageWide ? styles.imagePreviewWide : styles.imagePreview
                }
              />
            ) : (
              <Feather name="image" size={26} color="#8FA79A" />
            )}
          </TouchableOpacity>

          <View style={styles.imageLinks}>
            <TouchableOpacity activeOpacity={0.8} onPress={handlePickImage}>
              <Text style={styles.imageLinkText}>
                {image ? "Заменить картинку" : "Добавить картинку"}
              </Text>
            </TouchableOpacity>

            {!!image && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setImage("")}
                style={styles.imageRemove}
              >
                <Text style={styles.imageRemoveText}>Убрать</Text>
              </TouchableOpacity>
            )}

            {!image && (
              <Text style={styles.imageHint}>
                Необязательно. Квадрат или широкая — для горизонтальных
                логотипов.
              </Text>
            )}
          </View>
        </View>

        <Glass {...glassInputProps} style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError("");
            }}
            placeholder="Название *"
            placeholderTextColor="#8FA79A"
            maxLength={RESOURCE_TITLE_MAX}
          />
        </Glass>

        <Glass {...glassInputProps} style={styles.inputWrap}>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setError("");
            }}
            placeholder="Описание: что это и чем полезно *"
            placeholderTextColor="#8FA79A"
            multiline
            textAlignVertical="top"
            maxLength={RESOURCE_DESCRIPTION_MAX}
          />
        </Glass>

        <Glass {...glassInputProps} style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              setError("");
            }}
            placeholder="Ссылка * (например, site.ru)"
            placeholderTextColor="#8FA79A"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Glass>

        <Text style={styles.requiredHint}>{t("register.requiredHint")}</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving || !formValid}
          style={[
            styles.primaryShadow,
            (saving || !formValid) && styles.disabled,
          ]}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>
                {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
              </Text>
            </View>
          </Glass>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDelete}
            disabled={saving}
            style={styles.deleteLink}
          >
            <Text style={styles.deleteLinkText}>
              {deleteArmed
                ? "Нажмите ещё раз, чтобы удалить"
                : "Удалить ресурс"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          style={styles.cancelLink}
        >
          <Text style={styles.cancelLinkText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {cropSource && (
        <AvatarCropModal
          visible={cropVisible}
          uri={cropSource.uri}
          imageWidth={cropSource.width}
          imageHeight={cropSource.height}
          square
          allowWide
          title="Картинка ресурса"
          hint="Перетащите картинку и подберите масштаб — в карточку попадёт область внутри рамки"
          onCancel={() => setCropVisible(false)}
          onDone={(croppedUri, wide) => {
            setImage(croppedUri);
            setImageWide(!!wide);
            setCropVisible(false);
            setError("");
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardWrap: {
    flex: 1,
  },

  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
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
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 18,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 20,
  },

  imageBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  // Окошко картинки — тот же квадрат со скруглением, что на карточке.
  imageBox: {
    width: 84,
    height: 84,
    borderRadius: 20,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#F4FAF4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  imagePreview: {
    width: 84,
    height: 84,
  },

  // Широкая картинка 3:1 — окошко той же пропорции.
  imageBoxWide: {
    width: 168,
    height: 56,
    borderRadius: 14,
  },

  imagePreviewWide: {
    width: 168,
    height: 56,
  },

  imageLinks: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },

  imageLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  imageRemove: {
    marginTop: 8,
    alignSelf: "flex-start",
  },

  imageRemoveText: {
    fontSize: 14,
    color: "#C05B4D",
  },

  imageHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#96AC9E",
    marginTop: 4,
  },

  inputWrap: {
    marginBottom: 12,
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  textArea: {
    height: 120,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
  },

  requiredHint: {
    fontSize: 12.5,
    color: "#96AC9E",
    marginBottom: 12,
    marginLeft: 4,
  },

  error: {
    color: "#C05B4D",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },

  primaryShadow: {
    marginTop: 8,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.7,
  },

  deleteLink: {
    alignSelf: "center",
    marginTop: 22,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  deleteLinkText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#C05B4D",
  },

  cancelLink: {
    alignSelf: "center",
    marginTop: 16,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  cancelLinkText: {
    fontSize: 15,
    color: "#96AC9E",
  },
});
