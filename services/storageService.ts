import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

export const isRemoteAvatar = (uri?: string | null) => {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
};

export async function uploadAvatar(userId: string, localUri: string) {
  const filePath = `${userId}/${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

    return {
      filePath,
      publicUrl: data.publicUrl,
    };
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64' as any,
  });

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, decode(base64), {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  return {
    filePath,
    publicUrl: data.publicUrl,
  };
}

export async function removeAllUserAvatars(userId: string) {
  const { data, error } = await supabase.storage
    .from('avatars')
    .list(userId, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    throw new Error(error.message);
  }

  const filePaths =
    (data || [])
      .filter((item) => !!item.name)
      .map((item) => `${userId}/${item.name}`);

  if (filePaths.length === 0) {
    return;
  }

  const { error: removeError } = await supabase.storage
    .from('avatars')
    .remove(filePaths);

  if (removeError) {
    throw new Error(removeError.message);
  }
}