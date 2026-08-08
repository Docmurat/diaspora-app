import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  joinLocations,
  LocationFields,
  LocationPair,
  locationsValid,
} from "../components/locations";
import { Glass, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import { registerUser } from "../services/authService";
import { recordRegistrationConsents } from "../services/consentService";
import { translateAuthError } from "../services/errorService";
import { isRemoteAvatar, uploadAvatar } from "../services/storageService";
import {
  getMemorandumAccepted,
  setMemorandumAccepted,
} from "../store/consentFlow";
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

  // Согласия (152-ФЗ): ДВЕ отдельные галочки — согласие на обработку ПДн
  // обязано быть оформлено отдельно от прочих документов (ст. 9 в ред.
  // 156-ФЗ). Обе обязательны для отправки анкеты.
  const [consentPdn, setConsentPdn] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  // Меморандум руками не отмечается: галочка зажигается ТОЛЬКО кнопкой
  // «Принимаю» в конце текста меморандума (иначе не прочтут).
  const [consentMemo, setConsentMemo] = useState(false);

  useEffect(() => {
    setMemorandumAccepted(false); // чистый лист при входе в регистрацию
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (getMemorandumAccepted()) {
        setConsentMemo(true);
        setError("");
      }
    }, []),
  );
  const params = useLocalSearchParams();
  const inviteCode = String(params.inviteCode || "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [locations, setLocations] = useState<LocationPair[]>([
    { country: "", city: "" },
  ]);
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

  const [codeInput, setCodeInput] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendIn, setResendIn] = useState(0);

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
    locationsValid(locations);

  const step2Valid = categoryValid && !!profession.trim() && !!bio.trim();

  const filteredProfessions = useMemo(() => {
    const search = profession.trim().toLowerCase();
    if (!search) return [];

    return professions
      .filter((item) => item.toLowerCase().includes(search))
      .slice(0, 6);
  }, [profession]);

  // Таймер «Отправить код ещё раз»
  useEffect(() => {
    if (step !== 2 || resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendIn]);

  // Обращение к почтальону (серверной функции send-email-code)
  const callEmailCode = async (body: {
    action: "send" | "verify";
    email: string;
    code?: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("send-email-code", {
      body,
    });

    if (error) {
      let message = "Не удалось связаться с сервером. Попробуйте ещё раз.";
      try {
        const context = await (error as any).context?.json?.();
        if (context?.error) message = context.error;
      } catch {}
      throw new Error(message);
    }

    return data;
  };

  const sendVerificationCode = async () => {
    await callEmailCode({
      action: "send",
      email: email.trim().toLowerCase(),
    });
    setCodeInput("");
    setResendIn(60);
  };

  const handleResendCode = async () => {
    if (resendIn > 0 || checkingEmail) return;
    try {
      setCheckingEmail(true);
      setError("");
      await sendVerificationCode();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить код");
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verifyingCode) return;

    try {
      setVerifyingCode(true);
      setError("");

      await callEmailCode({
        action: "verify",
        email: email.trim().toLowerCase(),
        code: codeInput.trim(),
      });

      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неверный код");
    } finally {
      setVerifyingCode(false);
    }
  };

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
      !locationsValid(locations)
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

      // Отправляем код подтверждения и переходим на шаг ввода кода
      await sendVerificationCode();
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

    if (!consentPdn || !consentTerms || !consentMemo) {
      setError(
        "Для регистрации отметьте все три пункта: согласие на обработку данных, принятие соглашения и Меморандум сообщества",
      );
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
        country: joinLocations(locations).country,
        city: joinLocations(locations).city,
        category: matchedCategory,
        profession,
        bio,
        telegram,
        extraInfo: "",
        avatarPath: null,
      });

      // Журнал согласий: фиксируем принятые версии (не роняет регистрацию)
      await recordRegistrationConsents(result.userId);

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
          <Text style={styles.subtitle}>ШАГ {step} ИЗ 3</Text>

          <Tekmet style={styles.tekmet} />

          {step !== 2 && (
            <Text style={styles.requiredHint}>
              Поля со звёздочкой (*) обязательны
            </Text>
          )}

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

              <LocationFields
                pairs={locations}
                onChange={(next) => {
                  setLocations(next);
                  setError("");
                }}
              />

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
                      {checkingEmail ? "Отправка кода..." : "Далее"}
                    </Text>
                  </View>
                </Glass>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.codeText}>
                Мы отправили 6-значный код на{"\n"}
                <Text style={styles.codeEmail}>{email.trim()}</Text>
              </Text>

              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  placeholder="Код из письма"
                  placeholderTextColor="#8FA79A"
                  style={[styles.input, styles.codeInput]}
                  value={codeInput}
                  onChangeText={(text) => {
                    setCodeInput(text.replace(/[^0-9]/g, ""));
                    setError("");
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </Glass>

              <Text style={styles.hintCentered}>
                Код действует 10 минут. Письмо не пришло? Проверьте папку «Спам»
              </Text>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleVerifyCode}
                disabled={verifyingCode || codeInput.length !== 6}
                style={[
                  styles.primaryShadow,
                  (verifyingCode || codeInput.length !== 6) && styles.disabled,
                ]}
              >
                <Glass
                  radius={18}
                  tintColor="rgba(105,183,141,0.92)"
                  borderColor="rgba(255,255,255,0.85)"
                >
                  <View style={styles.buttonInner}>
                    <Text style={styles.primaryButtonText}>
                      {verifyingCode ? "Проверка..." : "Подтвердить"}
                    </Text>
                  </View>
                </Glass>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resendIn > 0 || checkingEmail}
                activeOpacity={0.8}
              >
                <Text style={[styles.link, resendIn > 0 && styles.linkMuted]}>
                  {resendIn > 0
                    ? `Запросить новый код можно через ${resendIn} сек`
                    : checkingEmail
                      ? "Отправка..."
                      : "Отправить код ещё раз"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setStep(1);
                  setCodeInput("");
                  setError("");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.link}>Изменить почту</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
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

              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.8}
                onPress={() => {
                  setConsentPdn((v) => !v);
                  setError("");
                }}
              >
                <View
                  style={[
                    styles.consentBox,
                    consentPdn && styles.consentBoxChecked,
                  ]}
                >
                  {consentPdn && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.consentText}>
                  Я даю согласие на обработку моих персональных данных{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => router.push("/consent" as any)}
                  >
                    (текст согласия)
                  </Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.8}
                onPress={() => {
                  setConsentTerms((v) => !v);
                  setError("");
                }}
              >
                <View
                  style={[
                    styles.consentBox,
                    consentTerms && styles.consentBoxChecked,
                  ]}
                >
                  {consentTerms && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.consentText}>
                  Принимаю{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => router.push("/terms" as any)}
                  >
                    Пользовательское соглашение
                  </Text>{" "}
                  и ознакомлен(а) с{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => router.push("/privacy" as any)}
                  >
                    Политикой конфиденциальности
                  </Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.8}
                onPress={() => {
                  if (consentMemo) {
                    // Снять принятие: галочка гаснет, кнопка отправки тухнет
                    setConsentMemo(false);
                    setMemorandumAccepted(false);
                  } else {
                    router.push("/memorandum?mode=accept" as any);
                  }
                }}
              >
                <View
                  style={[
                    styles.consentBox,
                    consentMemo && styles.consentBoxChecked,
                  ]}
                >
                  {consentMemo && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.consentText}>
                  {consentMemo ? (
                    "Меморандум «Минги-Тау» принят"
                  ) : (
                    <>
                      Меморандум «Минги-Тау» —{" "}
                      <Text style={styles.consentLink}>
                        прочитать и принять
                      </Text>
                    </>
                  )}
                </Text>
              </TouchableOpacity>

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
                  disabled={
                    submitting ||
                    !step2Valid ||
                    !consentPdn ||
                    !consentTerms ||
                    !consentMemo
                  }
                  style={[
                    styles.primaryShadow,
                    styles.primaryHalf,
                    (submitting ||
                      !step2Valid ||
                      !consentPdn ||
                      !consentTerms ||
                      !consentMemo) &&
                      styles.disabled,
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

  codeText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 16,
  },

  codeEmail: {
    color: "#3F6B5B",
    fontWeight: "600",
  },

  codeInput: {
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
  },

  hintCentered: {
    fontSize: 12.5,
    color: "#96AC9E",
    textAlign: "center",
    marginBottom: 12,
  },

  link: {
    color: "#96AC9E",
    textAlign: "center",
    fontSize: 14,
    marginTop: 18,
    textDecorationLine: "underline",
  },

  linkMuted: {
    opacity: 0.6,
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

  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    marginBottom: 8,
  },

  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(93,140,120,0.55)",
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },

  consentBoxChecked: {
    backgroundColor: "#69B78D",
    borderColor: "#69B78D",
  },

  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#4E7364",
  },

  consentLink: {
    color: "#96AC9E",
    textDecorationLine: "underline",
  },
});
