import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type PlayerPreferences = {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
};

const storageKey = 'hamster-battle:player-preferences:v1';

const defaultPreferences: PlayerPreferences = {
  notificationsEnabled: true,
  soundEnabled: true,
};

export async function getPlayerPreferences(): Promise<PlayerPreferences> {
  const value = await AsyncStorage.getItem(storageKey);
  if (!value) {
    return defaultPreferences;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Saved player preferences contain invalid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return defaultPreferences;
  }

  const preferences = parsed as Partial<PlayerPreferences>;
  return {
    notificationsEnabled:
      typeof preferences.notificationsEnabled === 'boolean'
        ? preferences.notificationsEnabled
        : defaultPreferences.notificationsEnabled,
    soundEnabled:
      typeof preferences.soundEnabled === 'boolean'
        ? preferences.soundEnabled
        : defaultPreferences.soundEnabled,
  };
}

export async function savePlayerPreferences(preferences: PlayerPreferences) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(preferences));
}

const tagsStorageKey = 'hamster-battle:player-tags:v1';

export function formatProfileTags(raw: string): string {
  if (!raw.trim()) {
    return '';
  }
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((tag) => {
      const clean = tag.replace(/^#+/, '');
      return clean ? `#${clean}` : '';
    })
    .filter(Boolean);
  return parts.join('   ');
}

export async function getPlayerTags(userKey = 'default'): Promise<string> {
  const value = await AsyncStorage.getItem(`${tagsStorageKey}:${userKey}`);
  return value ?? '';
}

export async function savePlayerTags(tags: string, userKey = 'default') {
  await AsyncStorage.setItem(`${tagsStorageKey}:${userKey}`, tags);
}

const avatarStorageKey = 'hamster-battle:player-avatar:v1';
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let legacyDefaultCleaned = false;

export type StoredAvatarState = {
  uri: string | null;
  pendingSync: boolean;
  cleared: boolean;
};

function canUseStorage() {
  return Platform.OS !== 'web' || typeof window !== 'undefined';
}

function cleanupLegacyDefaultAvatar() {
  if (legacyDefaultCleaned || !canUseStorage()) {
    return;
  }
  legacyDefaultCleaned = true;
  void AsyncStorage.removeItem(`${avatarStorageKey}:default`).catch(() => {});
}

function normalizeAvatarKey(userKey?: string | null): string | null {
  const key = userKey?.trim();
  if (!key || key === 'default') {
    return null;
  }
  return key;
}

function buildAvatarStorageKeys(userKey?: string | null, userId?: string | null): string[] {
  const keys: string[] = [];
  const trimmedUserId = userId?.trim();
  if (trimmedUserId) {
    keys.push(`${avatarStorageKey}:uid:${trimmedUserId}`);
  }
  const normalizedName = normalizeAvatarKey(userKey);
  if (normalizedName) {
    keys.push(`${avatarStorageKey}:${normalizedName}`);
  }
  return keys;
}

/** Checks whether an avatar URI can persist across reloads/restarts on the current platform. */
export function isUsableAvatarUri(uri: unknown): uri is string {
  if (typeof uri !== 'string') {
    return false;
  }
  const trimmed = uri.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith('blob:')) {
    return false;
  }
  if (Platform.OS === 'web' && trimmed.startsWith('file:')) {
    return false;
  }
  return true;
}

function parseStoredAvatarState(raw: string | null): StoredAvatarState | null {
  if (!raw) {
    return null;
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredAvatarState>;
      const uri = isUsableAvatarUri(parsed.uri) ? parsed.uri : null;
      return {
        uri,
        pendingSync: Boolean(parsed.pendingSync) && Boolean(uri),
        cleared: Boolean(parsed.cleared) && !uri,
      };
    } catch {
      return null;
    }
  }
  if (isUsableAvatarUri(raw)) {
    return { uri: raw, pendingSync: false, cleared: false };
  }
  return null;
}

/** Reads stored avatar state for a player (prioritizing immutable Supabase userId over nickname). */
export async function getPlayerAvatarState(
  userKey?: string | null,
  userId?: string | null
): Promise<StoredAvatarState | null> {
  if (!canUseStorage()) {
    return null;
  }
  cleanupLegacyDefaultAvatar();
  const keys = buildAvatarStorageKeys(userKey, userId);
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      continue;
    }
    const parsed = parseStoredAvatarState(raw);
    if (parsed && (parsed.uri || parsed.cleared)) {
      return parsed;
    }
    await AsyncStorage.removeItem(key).catch(() => {});
  }
  return null;
}

export async function getPlayerAvatar(
  userKey?: string | null,
  userId?: string | null
): Promise<string | null> {
  const state = await getPlayerAvatarState(userKey, userId);
  return state && !state.cleared ? state.uri : null;
}

async function savePlayerAvatarState(
  state: StoredAvatarState,
  userKey?: string | null,
  userId?: string | null
) {
  if (!canUseStorage()) {
    return;
  }
  cleanupLegacyDefaultAvatar();
  const keys = buildAvatarStorageKeys(userKey, userId);
  if (keys.length === 0) {
    return;
  }
  const serialized = JSON.stringify(state);
  await Promise.all(keys.map((key) => AsyncStorage.setItem(key, serialized)));
}

export async function savePlayerAvatar(
  uri: string,
  userKey?: string | null,
  userId?: string | null,
  pendingSync = false
) {
  if (!isUsableAvatarUri(uri)) {
    return;
  }
  await savePlayerAvatarState({ uri, pendingSync, cleared: false }, userKey, userId);
}

export async function removePlayerAvatar(userKey?: string | null, userId?: string | null) {
  if (!canUseStorage()) {
    return;
  }
  cleanupLegacyDefaultAvatar();
  const keys = buildAvatarStorageKeys(userKey, userId);
  await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
}

/** Migrates locally stored avatar when a player renames their nickname. */
export async function renamePlayerAvatar(
  previousUser: string,
  nextUser: string,
  userId?: string | null
) {
  if (!canUseStorage()) {
    return;
  }
  const prevKey = normalizeAvatarKey(previousUser);
  const nextKey = normalizeAvatarKey(nextUser);
  if (!nextKey || prevKey === nextKey) {
    return;
  }
  const state = await getPlayerAvatarState(previousUser, userId);
  if (state) {
    await savePlayerAvatarState(state, nextUser, userId);
  }
  if (prevKey) {
    await AsyncStorage.removeItem(`${avatarStorageKey}:${prevKey}`).catch(() => {});
  }
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c2 = BASE64_CHARS.indexOf(clean[i + 2]);
    const c3 = BASE64_CHARS.indexOf(clean[i + 3]);

    const chunk =
      ((c0 === -1 ? 0 : c0) << 18) |
      ((c1 === -1 ? 0 : c1) << 12) |
      ((c2 === -1 ? 0 : c2) << 6) |
      (c3 === -1 ? 0 : c3);
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
}

function getAssetMimeAndExtension(asset: Pick<ImagePickerAsset, 'uri' | 'mimeType' | 'fileName'>): {
  contentType: string;
  extension: string;
} {
  const mime = asset.mimeType?.toLowerCase().trim();
  if (mime === 'image/png') return { contentType: 'image/png', extension: 'png' };
  if (mime === 'image/webp') return { contentType: 'image/webp', extension: 'webp' };
  if (mime === 'image/gif') return { contentType: 'image/gif', extension: 'gif' };
  if (mime && mime.startsWith('image/')) {
    const sub = mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'jpg';
    return { contentType: mime, extension: sub === 'jpeg' ? 'jpg' : sub };
  }
  const sourceName = asset.fileName || asset.uri;
  const ext = sourceName.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return { contentType: 'image/png', extension: 'png' };
  if (ext === 'webp') return { contentType: 'image/webp', extension: 'webp' };
  return { contentType: 'image/jpeg', extension: 'jpg' };
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }
  const contentType = match[1].toLowerCase();
  const base64 = match[2];
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  return {
    bytes: decodeBase64ToBytes(base64),
    contentType,
    extension: ext,
  };
}

async function prepareWebAvatar(
  uri: string
): Promise<{ dataUrl: string; bytes: Uint8Array; contentType: string; extension: string } | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return await new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxSide = 512;
        const naturalW = img.naturalWidth || img.width || maxSide;
        const naturalH = img.naturalHeight || img.height || maxSide;
        const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
        const width = Math.max(1, Math.round(naturalW * scale));
        const height = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1] ?? '';
        if (!base64) {
          resolve(null);
          return;
        }
        resolve({
          dataUrl,
          bytes: decodeBase64ToBytes(base64),
          contentType: 'image/jpeg',
          extension: 'jpg',
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

async function uploadAvatarBytesToSupabase(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
  extension: string
): Promise<{ publicUrl: string; metadataSynced: boolean } | null> {
  if (bytes.byteLength === 0) {
    return null;
  }
  const bodyBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const avatarPath = `${userId}/avatars/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('battle-artwork')
    .upload(avatarPath, bodyBuffer, { upsert: false, contentType });

  if (uploadError) {
    console.warn('Could not upload avatar to storage:', uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage.from('battle-artwork').getPublicUrl(avatarPath);
  const publicUrl = urlData.publicUrl;
  const { error: authError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  });
  if (authError) {
    console.warn('Could not sync uploaded avatar URL to auth metadata:', authError);
  }

  return { publicUrl, metadataSynced: !authError };
}

async function resolveAuthenticatedUserId(fallbackUserId?: string | null): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }
  const { data: userData } = await supabase.auth.getUser();
  return userData.user?.id ?? fallbackUserId ?? null;
}

/**
 * Converts a picked image into a durable URI (uploads to Supabase Storage when authenticated,
 * with a persistent local data/file fallback so avatars survive restarts and page reloads).
 */
export async function persistPickedAvatar(
  asset: ImagePickerAsset,
  userKey: string,
  userId?: string | null
): Promise<string | null> {
  const resolvedUserId = await resolveAuthenticatedUserId(userId);
  let { contentType, extension } = getAssetMimeAndExtension(asset);
  let bytes: Uint8Array | null = null;
  let localFallbackUri: string | null = null;

  const webPrepared = await prepareWebAvatar(asset.uri);
  if (webPrepared) {
    bytes = webPrepared.bytes;
    contentType = webPrepared.contentType;
    extension = webPrepared.extension;
    localFallbackUri = webPrepared.dataUrl;
  } else {
    if (asset.base64) {
      bytes = decodeBase64ToBytes(asset.base64);
      if (asset.base64.length <= 1_500_000) {
        localFallbackUri = `data:${contentType};base64,${asset.base64}`;
      }
    }
    if (!bytes) {
      try {
        const response = await fetch(asset.uri);
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch (err) {
        console.warn('Could not read avatar bytes from URI:', err);
      }
    }
    if (!localFallbackUri && isUsableAvatarUri(asset.uri)) {
      localFallbackUri = asset.uri;
    }
  }

  // Persist a durable local copy immediately before network upload completes.
  if (localFallbackUri) {
    await savePlayerAvatar(localFallbackUri, userKey, resolvedUserId, Boolean(resolvedUserId));
  }

  if (resolvedUserId && bytes) {
    const uploaded = await uploadAvatarBytesToSupabase(resolvedUserId, bytes, contentType, extension);
    if (uploaded) {
      await savePlayerAvatar(uploaded.publicUrl, userKey, resolvedUserId, !uploaded.metadataSynced);
      return uploaded.publicUrl;
    }
  }

  return localFallbackUri;
}

/** Removes a user's avatar from local storage and clears Supabase user metadata. */
export async function clearPlayerAvatar(userKey: string, userId?: string | null) {
  const resolvedUserId = await resolveAuthenticatedUserId(userId);
  if (resolvedUserId) {
    await savePlayerAvatarState({ uri: null, pendingSync: false, cleared: true }, userKey, resolvedUserId);
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
    if (!error) {
      await removePlayerAvatar(userKey, resolvedUserId);
    } else {
      console.warn('Could not clear avatar metadata in Supabase:', error);
    }
  } else {
    await removePlayerAvatar(userKey, resolvedUserId);
  }
}

/** Reconciles local avatar state with Supabase auth metadata after app restart. */
export async function syncAvatarWithAuthUser(user: User, userKey: string): Promise<string | null> {
  const localState = await getPlayerAvatarState(userKey, user.id);
  const rawRemote = user.user_metadata?.avatar_url;

  if (typeof rawRemote === 'string' && rawRemote.startsWith('blob:')) {
    // Clean up stale ephemeral blob URL stored by an earlier version.
    void supabase.auth.updateUser({ data: { avatar_url: null } });
  }

  const remoteAvatar = isUsableAvatarUri(rawRemote) ? rawRemote : null;

  if (localState?.cleared) {
    if (rawRemote !== null && rawRemote !== undefined) {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (!error) {
        await removePlayerAvatar(userKey, user.id);
      }
    } else {
      await removePlayerAvatar(userKey, user.id);
    }
    return null;
  }

  if (localState?.pendingSync && localState.uri) {
    if (localState.uri.startsWith('http://') || localState.uri.startsWith('https://')) {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: localState.uri } });
      if (!error) {
        await savePlayerAvatar(localState.uri, userKey, user.id, false);
      }
      return localState.uri;
    }
    if (localState.uri.startsWith('data:')) {
      const parsed = parseDataUrl(localState.uri);
      if (parsed) {
        const uploaded = await uploadAvatarBytesToSupabase(
          user.id,
          parsed.bytes,
          parsed.contentType,
          parsed.extension
        );
        if (uploaded) {
          await savePlayerAvatar(uploaded.publicUrl, userKey, user.id, !uploaded.metadataSynced);
          return uploaded.publicUrl;
        }
      }
    }
    return localState.uri;
  }

  if (remoteAvatar) {
    if (remoteAvatar !== localState?.uri) {
      await savePlayerAvatar(remoteAvatar, userKey, user.id, false);
    }
    return remoteAvatar;
  }

  // Only treat explicit null on server as remote deletion; preserve un-synced legacy local avatars when undefined.
  if (rawRemote === null) {
    await removePlayerAvatar(userKey, user.id);
    return null;
  }

  return localState?.uri ?? null;
}


