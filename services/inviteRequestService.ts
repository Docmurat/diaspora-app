import { supabase } from '../lib/supabase';

export type CreateInviteRequestInput = {
  fullName: string;
  contact: string;
  about?: string;
};

type ParsedContact = {
  phone: string;
  telegram: string;
};

function normalizeTelegram(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  let candidate = trimmed
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^telegram\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@+/, '')
    .trim();

  candidate = candidate.replace(/^\/+/, '').replace(/\/+$/, '');

  if (!candidate) return '';

  if (!/^[A-Za-z0-9_]{5,32}$/.test(candidate)) {
    return '';
  }

  // Telegram username не должен быть только из цифр
  if (!/[A-Za-z]/.test(candidate)) {
    return '';
  }

  return `@${candidate}`;
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  let normalized = trimmed
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');

  if (!normalized) return '';

  // Российский номер в формате 8XXXXXXXXXX -> +7XXXXXXXXXX
  if (/^8\d{10}$/.test(normalized)) {
    normalized = `+7${normalized.slice(1)}`;
  }

  // Российский номер в формате 7XXXXXXXXXX -> +7XXXXXXXXXX
  if (/^7\d{10}$/.test(normalized)) {
    normalized = `+${normalized}`;
  }

  // Международный формат
  if (/^\+\d{10,15}$/.test(normalized)) {
    return normalized;
  }

  // Просто набор цифр без +
  if (/^\d{10,15}$/.test(normalized)) {
    return normalized;
  }

  return '';
}

function parseContact(contact: string): ParsedContact {
  const trimmed = contact.trim();

  if (!trimmed) {
    return { phone: '', telegram: '' };
  }

  const telegram = normalizeTelegram(trimmed);
  if (telegram) {
    return { phone: '', telegram };
  }

  const phone = normalizePhone(trimmed);
  if (phone) {
    return { phone, telegram: '' };
  }

  return { phone: '', telegram: '' };
}

export async function createInviteRequest(input: CreateInviteRequestInput) {
  const fullName = input.fullName.trim();
  const about = (input.about || '').trim();
  const parsed = parseContact(input.contact);

  if (!fullName) {
    throw new Error('Введите имя');
  }

  if (!parsed.phone && !parsed.telegram) {
    throw new Error('Укажите корректный телефон или Telegram');
  }

  const requestId = crypto.randomUUID();

  const { error } = await supabase.from('invite_requests').insert({
    id: requestId,
    full_name: fullName,
    phone: parsed.phone || null,
    telegram: parsed.telegram || null,
    about: about || null,
    status: 'new',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message || 'Не удалось создать заявку');
  }

  const contactLabel = parsed.phone
    ? `Телефон: ${parsed.phone}`
    : `Telegram: ${parsed.telegram}`;

  const initialMessage = [
    'Новая заявка на вступление.',
    `Имя: ${fullName}`,
    contactLabel,
    about ? `О себе: ${about}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const { error: messageError } = await supabase
    .from('moderation_messages')
    .insert({
      request_type: 'invite_request',
      request_id: requestId,
      author_role: 'system',
      message: initialMessage,
      read_by_user: true,
      read_by_moderator: false,
    });

  if (messageError) {
    throw new Error(messageError.message || 'Не удалось создать сообщение модерации');
  }

  return { id: requestId };
}