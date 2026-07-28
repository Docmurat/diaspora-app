export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Неизвестная ошибка';
}

export function translateAuthError(error: unknown): string {
  const message = normalizeErrorMessage(error);
  const raw = message.toLowerCase().trim();

  if (
    raw.includes('user already registered') ||
    raw.includes('already been registered') ||
    raw.includes('email address is already registered')
  ) {
    return 'Аккаунт с этой почтой уже существует';
  }

  if (
    raw.includes('invalid login credentials') ||
    raw.includes('invalid credentials')
  ) {
    return 'Неверная почта или пароль';
  }

  if (
    raw.includes('email not confirmed') ||
    raw.includes('confirm your email')
  ) {
    return 'Подтвердите email перед входом';
  }

  if (
    raw.includes('invalid email') ||
    raw.includes('email format is invalid')
  ) {
    return 'Некорректный email';
  }

  if (
    raw.includes('password should be at least') ||
    raw.includes('password is too weak') ||
    raw.includes('weak password')
  ) {
    return 'Пароль слишком слабый';
  }

  if (
    raw.includes('network request failed') ||
    raw.includes('network error') ||
    raw.includes('failed to fetch')
  ) {
    return 'Проблема с интернет-соединением';
  }

  if (
    raw.includes('signup is disabled') ||
    raw.includes('signups not allowed')
  ) {
    return 'Регистрация сейчас недоступна';
  }

  return message || 'Ошибка авторизации';
}

export function translateInviteError(error: unknown): string {
  const message = normalizeErrorMessage(error);
  const raw = message.toLowerCase().trim();

  if (
    raw.includes('инвайт не найден') ||
    raw.includes('invite not found')
  ) {
    return 'Инвайт-код не найден';
  }

  if (
    raw.includes('инвайт уже использован') ||
    raw.includes('invite already used')
  ) {
    return 'Этот инвайт уже использован';
  }

  if (
    raw.includes('инвайт недействителен') ||
    raw.includes('invite is invalid') ||
    raw.includes('invite invalid')
  ) {
    return 'Этот инвайт недействителен';
  }

  if (
    raw.includes('row-level security') ||
    raw.includes('permission denied') ||
    raw.includes('not allowed')
  ) {
    return 'Нет доступа к проверке инвайта';
  }

  return message || 'Ошибка проверки инвайта';
}