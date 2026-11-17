import AsyncStorage from '@react-native-async-storage/async-storage';

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

