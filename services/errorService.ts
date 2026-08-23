import { t } from "./i18nService";

export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return t("err.unknown");
}

export function translateAuthError(error: unknown): string {
  const message = normalizeErrorMessage(error);
  const raw = message.toLowerCase().trim();

  if (
    raw.includes('user already registered') ||
    raw.includes('already been registered') ||
    raw.includes('email address is already registered')
  ) {
    return t("err.emailExists");
  }

  if (
    raw.includes('invalid login credentials') ||
    raw.includes('invalid credentials')
  ) {
    return t("err.badCredentials");
  }

  if (
    raw.includes('email not confirmed') ||
    raw.includes('confirm your email')
  ) {
    return t("err.confirmEmail");
  }

  if (
    raw.includes('invalid email') ||
    raw.includes('email format is invalid')
  ) {
    return t("err.badEmail");
  }

  if (
    raw.includes('password should be at least') ||
    raw.includes('password is too weak') ||
    raw.includes('weak password')
  ) {
    return t("pass.error.weak");
  }

  if (
    raw.includes('network request failed') ||
    raw.includes('network error') ||
    raw.includes('failed to fetch')
  ) {
    return t("err.network");
  }

  if (
    raw.includes('signup is disabled') ||
    raw.includes('signups not allowed')
  ) {
    return t("err.signupDisabled");
  }

  return message || t("err.auth");
}

export function translateInviteError(error: unknown): string {
  const message = normalizeErrorMessage(error);
  const raw = message.toLowerCase().trim();

  if (
    raw.includes('инвайт не найден') ||
    raw.includes('invite not found')
  ) {
    return t("err.inviteNotFound");
  }

  if (
    raw.includes('инвайт уже использован') ||
    raw.includes('invite already used')
  ) {
    return t("err.inviteUsed");
  }

  if (
    raw.includes('инвайт недействителен') ||
    raw.includes('invite is invalid') ||
    raw.includes('invite invalid')
  ) {
    return t("err.inviteInvalid");
  }

  if (
    raw.includes('row-level security') ||
    raw.includes('permission denied') ||
    raw.includes('not allowed')
  ) {
    return t("err.inviteNoAccess");
  }

  return message || t("err.inviteCheck");
}