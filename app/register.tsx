import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
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
import { Glass, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import { registerUser } from "../services/authService";
import { translateAuthError } from "../services/errorService";
import { isRemoteAvatar, uploadAvatar } from "../services/storageService";
import { formatBirthDateInput, normalizeBirthDate } from "../store/user";

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

const professions = [
  "Стоматолог",
  "Терапевт",
  "Хирург",
  "Педиатр",
  "Юрист",
  "Адвокат",
  "Нотариус",
  "Учитель",
  "Преподаватель",
  "Программист",
  "Разработчик",
  "Дизайнер",
  "Маркетолог",
  "Бухгалтер",
  "Финансист",
  "Предприниматель",
  "Логист",
  "Водитель",
  "Риелтор",
  "Строитель",
  "Архитектор",
  "Няня",
  "Тренер",
  "Исследователь",
  "Госслужащий",
];

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function RegisterScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [step, setStep] = useState(1);
  const params = useLocalSearchParams();
  const inviteCode = String(params.inviteCode || "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [profession, setProfession] = useState("");
  const [bio, setBio] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [cropVisible, setCropVisible] = useState(false);
  const [cropSource, setCropSource] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [showProfessionSuggestions, setShowProfessionSuggestions] =
    useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const filteredCategories = useMemo(() => {
    const search = category.trim().toLowerCase();
    if (!search) return categories;

    return categories.filter((item) => item.toLowerCase().includes(search));
  }, [category]);

  const categoryValid = useMemo(
    () =>
      categories.some(
        (item) => item.toLowerCase() === category.trim().toLowerCase(),
      ),
    [category],
  );

  const step1Valid =
    !!email.trim() &&
    !!password.trim() &&
    !!phone.trim() &&
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!birthDateInput.trim() &&
    !!country.trim() &&
    !!city.trim();

  const step2Valid = categoryValid && !!profession.trim() && !!bio.trim();

  const filteredProfessions = useMemo(() => {
    const search = profession.trim().toLowerCase();
    if (!search) return [];

    return professions
      .filter((item) => item.toLowerCase().includes(search))
      .slice(0, 6);
  }, [profession]);

  const checkEmailExists = async (rawEmail: string) => {
    const normalizedEmail = rawEmail.trim().toLowerCase();

    const { data, error } = await supabase.rpc("check_email_exists", {
      input_email: normalizedEmail,
    });

    if (error) {
      throw new Error(error.message);
    }

    return !!data;
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Нет доступа", "Нужно разрешение на доступ к галерее.");
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

  const goToStepTwo = async () => {
    if (checkingEmail) return;

    if (
      !email.trim() ||
      !password.trim() ||
      !phone.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !birthDateInput.trim() ||
      !country.trim() ||
      !city.trim()
    ) {
      setError("Заполните все обязательные поля");
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError("Дата рождения должна быть в формате ДД.ММ.ГГГГ");
      return;
    }

    try {
      setCheckingEmail(true);
      setError("");

      const emailExists = await checkEmailExists(email);

      if (emailExists) {
        setError("Эта почта уже используется");
        return;
      }

      setStep(2);
    } catch (e) {
      setError(translateAuthError(e));
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleRegister = async () => {
    if (submitting) return;

    if (!inviteCode.trim()) {
      setError("Инвайт-код не найден. Вернитесь и введите код заново.");
      return;
    }

    if (!category.trim() || !profession.trim() || !bio.trim()) {
      setError("Заполните все обязательные поля");
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

    try {
      setSubmitting(true);
      setError("");

      const result = await registerUser({
        inviteCode,
        email,
        password,
        phone,
        phoneVisible,
        firstName,
        lastName,
        birthDate: normalizedBirthDate,
        country,
        city,
        category: matchedCategory,
        profession,
        bio,
        telegram,
        extraInfo: "",
        avatarPath: null,
      });

      if (avatarUri && !isRemoteAvatar(avatarUri)) {
        const uploaded = await uploadAvatar(result.userId, avatarUri);

        const { error: avatarUpdateError } = await supabase
          .from("users")
          .update({
            avatar_path: uploaded.publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", result.userId);

        if (avatarUpdateError) {
          throw new Error(avatarUpdateError.message);
        }
      }

      router.replace("/pending-approval");
    } catch (e) {
      setError(translateAuthError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
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
          <Text style={styles.title}>Регистрация</Text>
          <Text style={styles.subtitle}>ШАГ {step} ИЗ 2</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.requiredHint}>
            Поля со звёздочкой (*) обязательны
          </Text>

          {step === 1 && (
            <>
              <TouchableOpacity
                style={styles.avatarPicker}
                onPress={handlePickImage}
                activeOpacity={0.85}
              >
                <Image
                  source={
                    avatarUri
                      ? { uri: avatarUri }
                      : require("../assets/default-avatar.png")
                  }
                  style={styles.avatarImage}
                />
              </TouchableOpacity>

              <Text style={styles.avatarHint}>Добавить фото профиля</Text>

              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  placeholder="Электронная почта *"
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </Glass>

              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  placeholder="Пароль *"
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError("");
                  }}
                  secureTextEntry
                />
              </Glass>

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
                  placeholder="Имя *"
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    setError("");
                  }}
                />
              </Glass>

              <Glass {...glassInputProps} style={styles.inputWrap}>
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

              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  placeholder="Страна *"
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={country}
                  onChangeText={(text) => {
                    setCountry(text);
                    setError("");
                  }}
                />
              </Glass>

              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  placeholder="Город *"
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={city}
                  onChangeText={(text) => {
                    setCity(text);
                    setError("");
                  }}
                />
              </Glass>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={goToStepTwo}
                disabled={checkingEmail || !step1Valid}
                style={[
                  styles.primaryShadow,
                  (checkingEmail || !step1Valid) && styles.disabled,
                ]}
              >
                <Glass
                  radius={18}
                  tintColor="rgba(105,183,141,0.92)"
                  borderColor="rgba(255,255,255,0.85)"
                >
                  <View style={styles.buttonInner}>
                    <Text style={styles.primaryButtonText}>
                      {checkingEmail ? "Проверка..." : "Далее"}
                    </Text>
                  </View>
                </Glass>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  placeholder="Сфера деятельности *"
                  placeholderTextColor="#8FA79A"
                  style={styles.input}
                  value={category}
                  onChangeText={(text) => {
                    setCategory(text);
                    setShowCategoryOptions(true);
                    setError("");
                  }}
                  onFocus={() => setShowCategoryOptions(true)}
                />
              </Glass>

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
                      <Text style={styles.optionText}>{item}</Text>
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
                    setShowProfessionSuggestions(true);
                    setError("");
                  }}
                  onFocus={() => setShowProfessionSuggestions(true)}
                />
              </Glass>

              {showProfessionSuggestions && filteredProfessions.length > 0 && (
                <Glass {...glassInputProps} style={styles.optionsBox}>
                  {filteredProfessions.map((item, index) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.optionItem,
                        index === filteredProfessions.length - 1 &&
                          styles.optionItemLast,
                      ]}
                      onPress={() => {
                        setProfession(item);
                        setShowProfessionSuggestions(false);
                      }}
                    >
                      <Text style={styles.optionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </Glass>
              )}

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
                  placeholder="Telegram (необязательно)"
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

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setStep(1);
                    setError("");
                  }}
                  style={styles.secondaryWrap}
                >
                  <Glass
                    radius={18}
                    tintColor="rgba(255,255,255,0.5)"
                    borderColor="rgba(93,140,120,0.45)"
                    borderWidth={0.75}
                  >
                    <View style={styles.buttonInner}>
                      <Text style={styles.secondaryButtonText}>Назад</Text>
                    </View>
                  </Glass>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleRegister}
                  disabled={submitting || !step2Valid}
                  style={[
                    styles.primaryShadow,
                    styles.primaryHalf,
                    (submitting || !step2Valid) && styles.disabled,
                  ]}
                >
                  <Glass
                    radius={18}
                    tintColor="rgba(105,183,141,0.92)"
                    borderColor="rgba(255,255,255,0.85)"
                  >
                    <View style={styles.buttonInner}>
                      <Text style={styles.primaryButtonText}>
                        {submitting ? "Отправка..." : "Готово"}
                      </Text>
                    </View>
                  </Glass>
                </TouchableOpacity>
              </View>
            </>
          )}
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
            setCropVisible(false);
            setError("");
          }}
        />
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

  avatarPicker: {
    alignSelf: "center",
  },

  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
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
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
          outlineColor: "transparent",
        } as any)
      : {}),
  },

  textArea: {
    height: 110,
    paddingTop: 14,
    textAlignVertical: "top",
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

  label: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 14,
    color: "#719686",
    marginBottom: 8,
    marginLeft: 4,
  },

  selectField: {
    minHeight: 52,
    paddingHorizontal: 16,
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

  primaryShadow: {
    marginTop: 8,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  primaryHalf: {
    flex: 1,
    marginTop: 0,
    marginLeft: 8,
  },

  secondaryWrap: {
    flex: 1,
    marginRight: 8,
  },

  buttonsRow: {
    flexDirection: "row",
    marginTop: 8,
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
