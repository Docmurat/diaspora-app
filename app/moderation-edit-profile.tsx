import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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

import AvatarCropModal, {
  prepareAvatarSource,
} from "../components/AvatarCrop";
import {
  joinLocations,
  LocationFields,
  LocationPair,
  locationsValid,
  parseLocations,
} from "../components/locations";
import { Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import {
  normalizeHandle,
  normalizePhone,
} from "../services/contactsService";
import {
  isRemoteAvatar,
  removeAllUserAvatars,
  uploadAvatar,
} from "../services/storageService";
import { formatBirthDateForInput, normalizeBirthDate } from "../store/user";

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

const webNoOutline =
  Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {};

export default function ModerationEditProfileScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const params = useLocalSearchParams();
  const userId = String(params.userId || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [hasWhatsapp, setHasWhatsapp] = useState(false);
  const [birthDateInput, setBirthDateInput] = useState("");
  const [locations, setLocations] = useState<LocationPair[]>([
    { country: "", city: "" },
  ]);
  const [category, setCategory] = useState("");
  const [profession, setProfession] = useState("");
  const [bio, setBio] = useState("");
  const [telegram, setTelegram] = useState("");
  const [instagram, setInstagram] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false);
  const [cropSource, setCropSource] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [cropVisible, setCropVisible] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("users")
        .select("*, users_private(phone)")
        .eq("id", userId)
        .single();

      if (error) {
        throw new Error(error.message || "Не удалось загрузить профиль");
      }

      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setPhone((data as any).users_private?.phone || "");
      setPhoneVisible(data.phone_visible ?? true);
      setHasWhatsapp(data.has_whatsapp ?? false);
      setBirthDateInput(formatBirthDateForInput(data.birth_date || ""));
      setLocations(parseLocations(data.country, data.city));
      setCategory(data.category || "");
      setProfession(data.profession || "");
      setBio(data.bio || "");
      setTelegram(data.telegram || "");
      setInstagram(data.instagram || "");
      setExtraInfo(data.extra_info || "");
      setAvatarUri(data.avatar_path || "");
      setAvatarMarkedForRemoval(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось загрузить профиль";
      Alert.alert("Ошибка", message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadProfile();
    } else {
      setLoading(false);
      Alert.alert("Ошибка", "Не передан userId");
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

  const formValid =
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!phone.trim() &&
    !!birthDateInput.trim() &&
    locationsValid(locations) &&
    !!category.trim() &&
    !!profession.trim() &&
    !!bio.trim();

  const handleSave = async () => {
    if (!formValid) {
      setError("Заполните все обязательные поля");
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError("Дата рождения должна быть в формате ДД.ММ.ГГГГ");
      return;
    }

    try {
      setSaving(true);
      setError("");

      let avatarToSave: string | null = avatarMarkedForRemoval
        ? null
        : avatarUri || null;

      if (avatarMarkedForRemoval) {
        await removeAllUserAvatars(userId).catch(() => {});
        avatarToSave = null;
      } else if (avatarUri && !isRemoteAvatar(avatarUri)) {
        await removeAllUserAvatars(userId);
        const uploaded = await uploadAvatar(userId, avatarUri);
        avatarToSave = uploaded.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_visible: phoneVisible,
          has_whatsapp: hasWhatsapp,
          birth_date: normalizedBirthDate,
          country: joinLocations(locations).country,
          city: joinLocations(locations).city,
          category: category.trim(),
          profession: profession.trim(),
          bio: bio.trim(),
          telegram: normalizeHandle(telegram),
          instagram: normalizeHandle(instagram),
          extra_info: extraInfo.trim() || null,
          avatar_path: avatarToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(updateError.message || "Не удалось сохранить профиль");
      }

      // Телефон — в служебной таблице users_private (Веха 62);
      // модератору запись разрешена правилом «или admin».
      const { error: phoneError } = await supabase
        .from("users_private")
        .upsert({
          user_id: userId,
          phone: normalizePhone(phone),
          updated_at: new Date().toISOString(),
        });

      if (phoneError) {
        throw new Error(phoneError.message || "Не удалось сохранить телефон");
      }

      Alert.alert("Готово", "Профиль обновлён");
      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось сохранить профиль";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const displayedAvatarSource =
    avatarMarkedForRemoval || !avatarUri
      ? require("../assets/default-avatar.png")
      : { uri: avatarUri };

  const showRemoveButton = !!avatarUri && !avatarMarkedForRemoval;

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Редактирование</Text>
          <Text style={styles.subtitle}>РЕЖИМ МОДЕРАЦИИ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.requiredNote}>
            Поля со звёздочкой (*) обязательны
          </Text>

          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.avatarPicker}
              onPress={handlePickImage}
              activeOpacity={0.85}
            >
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

          <TextInput
            placeholder="Имя *"
            placeholderTextColor="#8FA79A"
            style={styles.input}
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              setError("");
            }}
          />

          <TextInput
            placeholder="Фамилия *"
            placeholderTextColor="#8FA79A"
            style={styles.input}
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              setError("");
            }}
          />

          <View style={[styles.input, styles.disabledInput]}>
            <Text style={styles.disabledInputText}>
              Почта недоступна для редактирования
            </Text>
          </View>

          <Text style={styles.hint}>
            Почту в режиме модерации изменять нельзя.
          </Text>

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
              trackColor={{ false: "#DCE7E0", true: "#A8D8C0" }}
              thumbColor={phoneVisible ? "#69B78D" : "#F4FAF4"}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>У человека есть WhatsApp</Text>
              <Text style={styles.switchHint}>
                При открытом номере в анкете появится кнопка WhatsApp
              </Text>
            </View>
            <Switch
              value={hasWhatsapp}
              onValueChange={setHasWhatsapp}
              trackColor={{ false: "#DCE7E0", true: "#A8D8C0" }}
              thumbColor={hasWhatsapp ? "#69B78D" : "#F4FAF4"}
            />
          </View>

          <TextInput
            placeholder="Дата рождения (ДД.ММ.ГГГГ) *"
            placeholderTextColor="#8FA79A"
            style={styles.input}
            value={birthDateInput}
            onChangeText={(text) => {
              setBirthDateInput(text);
              setError("");
            }}
          />

          <LocationFields
            pairs={locations}
            onChange={(next) => {
              setLocations(next);
              setError("");
            }}
          />

          <TouchableOpacity
            style={styles.selectField}
            activeOpacity={0.85}
            onPress={() => setShowCategoryOptions((prev) => !prev)}
          >
            <Text
              style={[
                styles.selectFieldText,
                !category && styles.selectPlaceholderText,
              ]}
            >
              {category || "Сфера деятельности *"}
            </Text>
            <Text style={styles.selectArrow}>
              {showCategoryOptions ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {showCategoryOptions && (
            <View style={styles.optionsBox}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.optionItem}
                  onPress={() => {
                    setCategory(item);
                    setShowCategoryOptions(false);
                    setError("");
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
            textAlignVertical="top"
          />

          <TextInput
            placeholder="Telegram"
            placeholderTextColor="#8FA79A"
            style={styles.input}
            value={telegram}
            onChangeText={(text) => {
              setTelegram(text);
              setError("");
            }}
          />

          <TextInput
            placeholder="Instagram"
            placeholderTextColor="#8FA79A"
            style={styles.input}
            value={instagram}
            onChangeText={(text) => {
              setInstagram(text);
              setError("");
            }}
          />

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
            textAlignVertical="top"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving || !formValid}
            style={[
              styles.primaryButton,
              styles.primaryShadow,
              (saving || !formValid) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              router.replace({
                pathname: "/user-profile",
                params: {
                  userId,
                  mode: "moderation",
                },
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Отмена</Text>
          </TouchableOpacity>
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

  keyboardWrap: {
    flex: 1,
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  container: {
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 48,
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

  requiredNote: {
    fontSize: 12.5,
    color: "#96AC9E",
    textAlign: "center",
    marginBottom: 18,
  },

  avatarWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },

  avatarPicker: {
    alignSelf: "center",
  },

  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#EAF4EE",
  },

  removeAvatarButton: {
    position: "absolute",
    right: "50%",
    marginRight: -72,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7E988B",
  },

  avatarHint: {
    textAlign: "center",
    color: "#96AC9E",
    fontSize: 12.5,
    marginBottom: 18,
  },

  input: {
    minHeight: 52,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    fontSize: 15.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  disabledInput: {
    backgroundColor: "rgba(93,140,120,0.06)",
    justifyContent: "center",
  },

  disabledInputText: {
    fontSize: 15.5,
    color: "#8FA79A",
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    marginBottom: 12,
  },

  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  switchTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#2F4A3C",
    marginBottom: 4,
  },

  switchHint: {
    fontSize: 12.5,
    color: "#8FA79A",
    lineHeight: 17,
  },

  selectField: {
    minHeight: 52,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectFieldText: {
    flex: 1,
    fontSize: 15.5,
    color: "#2F4A3C",
  },

  selectPlaceholderText: {
    color: "#8FA79A",
  },

  selectArrow: {
    fontSize: 12,
    color: "#719686",
    marginLeft: 10,
  },

  optionsBox: {
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginTop: -4,
    marginBottom: 12,
    overflow: "hidden",
  },

  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.75,
    borderBottomColor: "rgba(93,140,120,0.14)",
  },

  optionText: {
    fontSize: 15,
    color: "#4E7364",
  },

  textArea: {
    height: 110,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
  },

  hint: {
    fontSize: 12.5,
    color: "#96AC9E",
    marginTop: -4,
    marginBottom: 12,
    marginLeft: 4,
    lineHeight: 17,
  },

  error: {
    color: "#C05B4D",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },

  primaryButton: {
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 8,
  },

  primaryShadow: {
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 12,
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
