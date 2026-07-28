import AsyncStorage from '@react-native-async-storage/async-storage';

export type ModerationStatus = 'pending' | 'approved';

export type AppUser = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  birthDate: string; // хранится как YYYY-MM-DD
  country: string;
  city: string;
  category: string;
  profession: string;
  bio: string;
  moderationStatus: ModerationStatus;
  telegram?: string;
  extraInfo?: string;
  avatarUri?: string;
};

const USER_KEY = 'diaspora_registered_user';
const SESSION_KEY = 'diaspora_logged_in';

let currentUser: AppUser | null = null;
let loggedIn = false;

export function getCurrentUser() {
  return currentUser;
}

export function isLoggedIn() {
  return loggedIn;
}

export function isApproved() {
  return currentUser?.moderationStatus === 'approved';
}

export function isPending() {
  return currentUser?.moderationStatus === 'pending';
}

export async function loadUserData() {
  try {
    const savedUser = await AsyncStorage.getItem(USER_KEY);
    const savedSession = await AsyncStorage.getItem(SESSION_KEY);

    currentUser = savedUser ? JSON.parse(savedUser) : null;
    loggedIn = savedSession === 'true';
  } catch (error) {
    console.log('Ошибка загрузки данных пользователя:', error);
    currentUser = null;
    loggedIn = false;
  }

  return {
    user: currentUser,
    loggedIn,
  };
}

export async function saveCurrentUser(user: AppUser) {
  currentUser = user;
  loggedIn = true;

  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    await AsyncStorage.setItem(SESSION_KEY, 'true');
  } catch (error) {
    console.log('Ошибка сохранения пользователя:', error);
  }
}

export async function updateCurrentUser(updatedFields: Partial<AppUser>) {
  if (!currentUser) return;

  currentUser = {
    ...currentUser,
    ...updatedFields,
  };

  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  } catch (error) {
    console.log('Ошибка обновления пользователя:', error);
  }
}

export async function logoutUser() {
  loggedIn = false;

  try {
    await AsyncStorage.setItem(SESSION_KEY, 'false');
  } catch (error) {
    console.log('Ошибка выхода пользователя:', error);
  }
}

export async function clearAllUserData() {
  currentUser = null;
  loggedIn = false;

  try {
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.log('Ошибка полного удаления пользователя:', error);
  }
}

export async function emailExists(email: string) {
  if (!currentUser) {
    await loadUserData();
  }

  if (!currentUser) return false;

  return currentUser.email.trim().toLowerCase() === email.trim().toLowerCase();
}

export async function loginWithEmail(email: string) {
  if (!currentUser) {
    await loadUserData();
  }

  if (!currentUser) return false;

  const match =
    currentUser.email.trim().toLowerCase() === email.trim().toLowerCase();

  if (match) {
    loggedIn = true;
    await AsyncStorage.setItem(SESSION_KEY, 'true');
    return true;
  }

  return false;
}

export function getAgeFromBirthDate(birthDate: string) {
  if (!birthDate) return '';

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';

  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age.toString();
}

/**
 * Форматирует ввод на лету:
 * 0        -> 0
 * 01       -> 01
 * 010      -> 01.0
 * 0101     -> 01.01
 * 01011990 -> 01.01.1990
 */
export function formatBirthDateInput(input: string) {
  const digits = input.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function normalizeBirthDate(input: string) {
  const trimmed = input.trim();

  if (!trimmed) return '';

  let prepared = trimmed;

  // Поддержка ввода без точек: 01011990 -> 01.01.1990
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (/^\d{8}$/.test(digitsOnly)) {
    prepared = `${digitsOnly.slice(0, 2)}.${digitsOnly.slice(2, 4)}.${digitsOnly.slice(4, 8)}`;
  }

  const match = prepared.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) return '';

  const [, dd, mm, yyyy] = match;

  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  if (month < 1 || month > 12) return '';
  if (day < 1 || day > 31) return '';
  if (year < 1900 || year > 2100) return '';

  const iso = `${yyyy}-${mm}-${dd}`;
  const testDate = new Date(iso);

  if (Number.isNaN(testDate.getTime())) return '';
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() + 1 !== month ||
    testDate.getDate() !== day
  ) {
    return '';
  }

  return iso;
}

export function formatBirthDateForInput(isoDate: string) {
  if (!isoDate) return '';

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const [, yyyy, mm, dd] = match;
  return `${dd}.${mm}.${yyyy}`;
}