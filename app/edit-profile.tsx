import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AvatarCropModal, { prepareAvatarSource } from "../components/AvatarCrop";
import {
  joinLocations,
  LocationFields,
  LocationPair,
  locationsValid,
  parseLocations,
} from "../components/locations";
import { Glass, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import {
  DbUserProfile,
  getMyProfile,
  syncMyEmailFromAuth,
} from "../services/profileService";
import {
  isRemoteAvatar,
  removeAllUserAvatars,
  uploadAvatar,
} from "../services/storageService";
import {
  formatBirthDateForInput,
  formatBirthDateInput,
  normalizeBirthDate,
} from "../store/user";

const categories = [
  "Медицина",
  "Юриспруденция",
  "Образование",
  "IT и технологии",
  "Бизнес и финансы",
  "Строительство и недвижимость",
  "Логистика и транспорт",
  "Услуги и сервис",
  "Маркетинг и медиа",
  "Дизайн и творчество",
  "Государственная служба",
  "Наука и исследования",
  "Спорт и здоровье",
  "Дом и быт",
  "Другое",
];

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function EditProfileScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [birthDateInput, setBirthDateInput] = useState("");
  const [locations, setLocations] = useState<LocationPair[]>([
    { country: "", city: "" },
  ]);
  const [category, setCategory] = useState("");
  const [profession, setProfession] = useState("");
  const [bio, setBio] = useState("");
  const [telegram, setTelegram] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false);
  const [error, setError] = useState("");
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cropVisible, setCropVisible] = useState(false);
  const [cropSource, setCropSource] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  // Анкета возвращена модератором на доработку
  const needsRevision = (user as any)?.moderation_status === "needs_revision";

  const canEditNameDirectly =
    user?.role === "moderator" || user?.role === "owner" || needsRevision;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      await syncMyEmailFromAuth();
      const profile = await getMyProfile();
      setUser(profile);

      if (profile) {
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setPhoneVisible(profile.phone_visible ?? true);
        setBirthDateInput(formatBirthDateForInput(profile.birth_date || ""));
        setLocations(parseLocations(profile.country, profile.city));
        setCategory(profile.category || "");
        setProfession(profile.profession || "");
        setBio(profile.bio || "");
        setTelegram(profile.telegram || "");
        setExtraInfo(profile.extra_info || "");
        setAvatarUri(profile.avatar_path || "");
        setAvatarMarkedForRemoval(false);
      }
    } catch (e) {
      console.log("Ошибка загрузки профиля для редактирования:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  // Категория — только из списка (Веха 57, замечание владельца): поле не
  // редактируется руками, нажатие раскрывает полный список.
  const filteredCategories = categories;

  const categoryValid = useMemo(
    () =>
      categories.some(
        (item) => item.toLowerCase() === category.trim().toLowerCase(),
      ),
    [category],
  );

  const formValid =
    !!phone.trim() &&
    !!birthDateInput.trim() &&
    locationsValid(locations) &&
    categoryValid &&
    !!profession.trim() &&
    !!bio.trim() &&
    (!canEditNameDirectly || (!!firstName.trim() && !!lastName.trim()));

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError("Нужно разрешение на доступ к галерее.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];

      // Сразу уменьшаем фото, чтобы не держать в памяти тяжёлый оригинал
      const prepared = await prepareAvatarSource(
        asset.uri,
        asset.width || 0,
        asset.height || 0,
      );

      setCropSource(prepared);
      setCropVisible(true);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarMarkedForRemoval(true);
    setError("");
  };

  const handleSave = async () => {
    if (saving) return;

    if (
      !email.trim() ||
      !phone.trim() ||
      !birthDateInput.trim() ||
      !locationsValid(locations) ||
      !category.trim() ||
      !profession.trim() ||
      !bio.trim()
    ) {
      setError("Заполните все обязательные поля");
      return;
    }

    if (canEditNameDirectly && (!firstName.trim() || !lastName.trim())) {
      setError("Имя и фамилия не могут быть пустыми");
      return;
    }

    const matchedCategory = categories.find(
      (item) => item.toLowerCase() === category.trim().toLowerCase(),
    );

    if (!matchedCategory) {
      setError("Выберите сферу деятельности из списка");
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError("Дата рождения должна быть в формате ДД.ММ.ГГГГ");
      return;
    }

    if (!user) {
      setError("Профиль не найден");
      return;
    }

    try {
      setSaving(true);
      setError("");

      let avatarToSave: string | null = avatarMarkedForRemoval
        ? null
        : avatarUri || null;

      if (avatarMarkedForRemoval) {
        await removeAllUserAvatars(user.id);
        avatarToSave = null;
      } else if (avatarUri && !isRemoteAvatar(avatarUri)) {
        await removeAllUserAvatars(user.id);
        const uploaded = await uploadAvatar(user.id, avatarUri);
        avatarToSave = uploaded.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          ...(canEditNameDirectly
            ? {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
              }
            : {}),
          email,
          phone,
          phone_visible: phoneVisible,
          birth_date: normalizedBirthDate,
          country: joinLocations(locations).country,
          city: joinLocations(locations).city,
          category: matchedCategory,
          // Сменил сферу — подтверждение квалификации теряет силу
          // (Веха 57): иначе врач, ставший «юристом», получил бы доступ к
          // чужим скрытым материалам. Новое подтверждение — через запрос.
          ...(matchedCategory !== (user.category || "") &&
          (user as any).qualification_confirmed_at
            ? { qualification_confirmed_at: null, qualification_confirmed_by: null }
            : {}),
          profession,
          bio,
          telegram: telegram || null,
          extra_info: extraInfo || null,
          avatar_path: avatarToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (needsRevision) {
        // Возвращаем на экран ожидания: там человек допишет сопроводительное
        // письмо (по желанию) и сам отправит анкету повторно.
        Alert.alert(
          "Изменения сохранены",
          "Теперь отправьте анкету повторно — при желании добавьте сообщение модератору.",
        );

        router.replace("/pending-approval");
        return;
      }

      router.back();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Не удалось сохранить изменения";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const displayedAvatarSource =
    avatarMarkedForRemoval || !avatarUri
      ? require("../assets/default-avatar.png")
      : { uri: avatarUri };

  const showRemoveButton = !!avatarUri && !avatarMarkedForRemoval;

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyContainer}>
          <Text style={styles.title}>Профиль не найден</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Редактирование</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.requiredHint}>
            Поля со звёздочкой (*) обязательны
          </Text>

          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85}>
              <Image
                source={displayedAvatarSource}
                style={styles.avatarImage}
              />
            </TouchableOpacity>

            {showRemoveButton && (
              <TouchableOpacity
                style={styles.removeAvatarButton}
                onPress={handleRemoveAvatar}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.removeAvatarText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.avatarHint}>
            Нажмите, чтобы изменить фото профиля
          </Text>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder={canEditNameDirectly ? "Имя *" : "Имя"}
              placeholderTextColor="#8FA79A"
              style={[styles.input, !canEditNameDirectly && styles.inputMuted]}
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                setError("");
              }}
              editable={canEditNameDirectly}
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder={canEditNameDirectly ? "Фамилия *" : "Фамилия"}
              placeholderTextColor="#8FA79A"
              style={[styles.input, !canEditNameDirectly && styles.inputMuted]}
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                setError("");
              }}
              editable={canEditNameDirectly}
            />
          </Glass>

          {!canEditNameDirectly && (
            <>
              <Text style={styles.hint}>
                Имя и фамилия меняются только после модерации администрацией
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/request-name-change")}
                style={styles.smallButtonWrap}
              >
                <Glass
                  radius={16}
                  tintColor="rgba(255,255,255,0.5)"
                  borderColor="rgba(93,140,120,0.45)"
                  borderWidth={0.75}
                >
                  <View style={styles.smallButtonInner}>
                    <Text style={styles.smallButtonText}>
                      Запросить изменение
                    </Text>
                  </View>
                </Glass>
              </TouchableOpacity>
            </>
          )}

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Электронная почта"
              placeholderTextColor="#8FA79A"
              style={[styles.input, styles.inputMuted]}
              value={email}
              editable={false}
            />
          </Glass>

          <Text style={styles.hint}>
            Смена почты подтверждается письмом на новый адрес
          </Text>

          <View style={styles.smallButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/change-email")}
              style={styles.smallButtonHalf}
            >
              <Glass
                radius={16}
                tintColor="rgba(255,255,255,0.5)"
                borderColor="rgba(93,140,120,0.45)"
                borderWidth={0.75}
              >
                <View style={styles.smallButtonInner}>
                  <Text style={styles.smallButtonText}>Сменить почту</Text>
                </View>
              </Glass>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/change-password")}
              style={[styles.smallButtonHalf, styles.smallButtonHalfRight]}
            >
              <Glass
                radius={16}
                tintColor="rgba(255,255,255,0.5)"
                borderColor="rgba(93,140,120,0.45)"
                borderWidth={0.75}
              >
                <View style={styles.smallButtonInner}>
                  <Text style={styles.smallButtonText}>Сменить пароль</Text>
                </View>
              </Glass>
            </TouchableOpacity>
          </View>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Номер телефона *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setError("");
              }}
              keyboardType="phone-pad"
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>
                  Показывать номер в профиле
                </Text>
                <Text style={styles.switchHint}>
                  Выключите, чтобы номер был доступен только администрации
                </Text>
              </View>
              <Switch
                value={phoneVisible}
                onValueChange={setPhoneVisible}
                trackColor={{ false: "#D6E4DA", true: "#9FD4B4" }}
                thumbColor={phoneVisible ? "#69B78D" : "#FFFFFF"}
              />
            </View>
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Дата рождения (ДД.ММ.ГГГГ) *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={birthDateInput}
              onChangeText={(text) => {
                setBirthDateInput(formatBirthDateInput(text));
                setError("");
              }}
              keyboardType="number-pad"
            />
          </Glass>

          <LocationFields
            pairs={locations}
            onChange={(next) => {
              setLocations(next);
              setError("");
            }}
          />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setShowCategoryOptions((v) => !v);
              setError("");
            }}
          >
            <Glass {...glassInputProps} style={styles.inputWrap}>
              <View style={styles.selectRow}>
                <Text
                  style={[
                    styles.input,
                    styles.selectText,
                    !category && styles.selectPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {category || "Сфера деятельности *"}
                </Text>
                <Text style={styles.selectChevron}>
                  {showCategoryOptions ? "▴" : "▾"}
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>

          {showCategoryOptions && filteredCategories.length > 0 && (
            <Glass {...glassInputProps} style={styles.optionsBox}>
              {filteredCategories.map((item, index) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.optionItem,
                    index === filteredCategories.length - 1 &&
                      styles.optionItemLast,
                  ]}
                  onPress={() => {
                    setCategory(item);
                    setShowCategoryOptions(false);
                    setError("");
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item === category && styles.optionTextActive,
                    ]}
                  >
                    {item === category ? "✓ " : ""}
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </Glass>
          )}

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Профессия *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={profession}
              onChangeText={(text) => {
                setProfession(text);
                setError("");
              }}
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Чем могу быть полезен *"
              placeholderTextColor="#8FA79A"
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={(text) => {
                setBio(text);
                setError("");
              }}
              multiline
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Telegram"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={telegram}
              onChangeText={(text) => {
                setTelegram(text);
                setError("");
              }}
              autoCapitalize="none"
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Дополнительные сведения (портфолио, отзывы, ссылки)"
              placeholderTextColor="#8FA79A"
              style={[styles.input, styles.textArea]}
              value={extraInfo}
              onChangeText={(text) => {
                setExtraInfo(text);
                setError("");
              }}
              multiline
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.back()}
              style={styles.secondaryWrap}
            >
              <Glass
                radius={18}
                tintColor="rgba(255,255,255,0.5)"
                borderColor="rgba(93,140,120,0.45)"
                borderWidth={0.75}
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.secondaryButtonText}>Отмена</Text>
                </View>
              </Glass>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving || !formValid}
              style={[
                styles.primaryShadow,
                styles.primaryHalf,
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
                    {saving ? "Сохранение..." : "Сохранить"}
                  </Text>
                </View>
              </Glass>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {cropSource && (
        <AvatarCropModal
          visible={cropVisible}
          uri={cropSource.uri}
          imageWidth={cropSource.width}
          imageHeight={cropSource.height}
          onCancel={() => setCropVisible(false)}
          onDone={(croppedUri) => {
            setAvatarUri(croppedUri);
            setAvatarMarkedForRemoval(false);
            setCropVisible(false);
            setError("");
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  keyboardWrap: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 40,
    flexGrow: 1,
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
    marginBottom: 10,
  },

  requiredHint: {
    fontSize: 12.5,
    color: "#96AC9E",
    textAlign: "center",
    marginBottom: 16,
  },

  avatarWrapper: {
    alignSelf: "center",
  },

  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },

  removeAvatarButton: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#C05B4D",
    alignItems: "center",
    justifyContent: "center",
  },

  removeAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 16,
  },

  avatarHint: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 13.5,
    color: "#719686",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
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

  inputMuted: {
    color: "#8FA79A",
  },

  textArea: {
    height: 110,
    paddingTop: 14,
    textAlignVertical: "top",
  },

  hint: {
    fontSize: 12.5,
    color: "#96AC9E",
    marginBottom: 10,
    marginLeft: 4,
  },

  smallButtonWrap: {
    marginBottom: 12,
  },

  smallButtonsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },

  smallButtonHalf: {
    flex: 1,
  },

  smallButtonHalfRight: {
    marginLeft: 8,
  },

  smallButtonInner: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  smallButtonText: {
    color: "#3F6B5B",
    fontSize: 14,
    fontWeight: "600",
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  switchTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F6B5B",
    marginBottom: 4,
  },

  switchHint: {
    fontSize: 12,
    color: "#7E988B",
    lineHeight: 17,
  },

  selectRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  selectText: {
    flex: 1,
    lineHeight: 52,
    ...(Platform.OS === "android" ? { textAlignVertical: "center" as const } : {}),
  },

  selectPlaceholder: {
    color: "#8FA79A",
  },

  selectChevron: {
    fontSize: 14,
    color: "#719686",
    paddingRight: 14,
  },

  optionTextActive: {
    color: "#3F6B5B",
    fontWeight: "600",
  },

  optionsBox: {
    marginTop: -4,
    marginBottom: 12,
  },

  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.75,
    borderBottomColor: "rgba(93,140,120,0.2)",
  },

  optionItemLast: {
    borderBottomWidth: 0,
  },

  optionText: {
    fontSize: 15,
    color: "#4E7364",
  },

  error: {
    color: "#C05B4D",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },

  buttonsRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  secondaryWrap: {
    flex: 1,
    marginRight: 8,
  },

  primaryShadow: {
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  primaryHalf: {
    flex: 1,
    marginLeft: 8,
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

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 16,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.7,
  },
});
