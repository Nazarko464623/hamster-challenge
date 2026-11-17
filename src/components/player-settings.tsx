import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { renameMineData } from '@/lib/battles';
import {
  formatProfileTags,
  getPlayerAvatar,
  getPlayerPreferences,
  getPlayerTags,
  savePlayerAvatar,
  savePlayerPreferences,
  savePlayerTags,
} from '@/lib/player-settings';
import { supabase } from '@/lib/supabase';
import { themeColor, useAppTheme, useThemedStyles, type ThemeMode } from '@/components/app-theme-provider';

type PlayerSettingsProps = {
  displayName: string;
  initialTags?: string;
  onClose: () => void;
  onNameSaved: (name: string) => void;
  onTagsSaved?: (tags: string) => void;
};

export function PlayerSettings({
  displayName,
  initialTags,
  onClose,
  onNameSaved,
  onTagsSaved,
}: PlayerSettingsProps) {
  const styles = useThemedStyles(baseStyles);
  const { mode, ready: themeReady, setMode, loadError } = useAppTheme();
  const [name, setName] = useState(displayName);
  const [tags, setTags] = useState(initialTags ?? '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [tagsMessage, setTagsMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [logoutMessage, setLogoutMessage] = useState('');
  const [appearanceMessage, setAppearanceMessage] = useState('');
  const preferencesRef = useRef({
    notificationsEnabled: true,
    soundEnabled: true,
  });
  const preferenceSaveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    getPlayerPreferences()
      .then((preferences) => {
        if (active) {
          preferencesRef.current = preferences;
          setNotificationsEnabled(preferences.notificationsEnabled);
          setSoundEnabled(preferences.soundEnabled);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load player preferences:', error);
        if (active) {
          setSettingsMessage('Could not load saved preferences. You can still update them.');
        }
      })
      .finally(() => {
        if (active) {
          setPreferencesReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (initialTags !== undefined) {
      setTags(initialTags);
    } else {
      getPlayerTags(displayName).then((savedTags) => {
        if (active && savedTags) {
          setTags(savedTags);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [displayName, initialTags]);

  const updatePreference = async (preference: 'notificationsEnabled' | 'soundEnabled', value: boolean) => {
    if (!preferencesReady) {
      return;
    }

    const previousPreferences = preferencesRef.current;
    const nextPreferences = {
      notificationsEnabled:
        preference === 'notificationsEnabled' ? value : previousPreferences.notificationsEnabled,
      soundEnabled: preference === 'soundEnabled' ? value : previousPreferences.soundEnabled,
    };

    preferencesRef.current = nextPreferences;
    if (preference === 'notificationsEnabled') {
      setNotificationsEnabled(value);
    } else {
      setSoundEnabled(value);
    }

    setSettingsMessage('');
    const save = preferenceSaveQueue.current.then(() => savePlayerPreferences(nextPreferences));
    preferenceSaveQueue.current = save.catch(() => {});
    try {
      await save;
    } catch (error) {
      console.error('Failed to save player preferences:', error);
      const currentPreferences = preferencesRef.current;
      if (preference === 'notificationsEnabled' && currentPreferences.notificationsEnabled === value) {
        preferencesRef.current = {
          ...currentPreferences,
          notificationsEnabled: previousPreferences.notificationsEnabled,
        };
        setNotificationsEnabled(previousPreferences.notificationsEnabled);
      } else if (preference === 'soundEnabled' && currentPreferences.soundEnabled === value) {
        preferencesRef.current = {
          ...currentPreferences,
          soundEnabled: previousPreferences.soundEnabled,
        };
        setSoundEnabled(previousPreferences.soundEnabled);
      }
      setSettingsMessage('Could not save this preference. Please try again.');
    }
  };

  const saveName = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameMessage('Enter a player name before saving.');
      return;
    }

    setSavingName(true);
    setNameMessage('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: { nickname: trimmedName },
      });
      if (error) {
        setNameMessage(error.message);
        return;
      }

      try {
        await renameMineData(displayName, trimmedName);
        if (tags) {
          await savePlayerTags(tags, trimmedName);
        }
        const currentAvatar = await getPlayerAvatar(displayName);
        if (currentAvatar) {
          await savePlayerAvatar(currentAvatar, trimmedName);
        }
      } catch (error) {
        console.error('Failed to move player battle data after renaming:', error);
        onNameSaved(trimmedName);
        setNameMessage('Your name was saved, but some local battle data could not be moved.');
        return;
      }

      onNameSaved(trimmedName);
      setNameMessage('Player name saved to your account.');
    } catch (error) {
      console.error('Failed to save player name:', error);
      setNameMessage('Could not save your player name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const saveTags = async () => {
    const formatted = formatProfileTags(tags);
    setSavingTags(true);
    setTagsMessage('');
    try {
      await savePlayerTags(formatted, displayName);

      try {
        await supabase.auth.updateUser({
          data: { profile_tags: formatted },
        });
      } catch (authError) {
        console.warn('Could not sync tags to supabase auth:', authError);
      }

      setTags(formatted);
      onTagsSaved?.(formatted);
      setTagsMessage(formatted ? 'Profile tags saved.' : 'Profile tags cleared.');
    } catch (error) {
      console.error('Failed to save profile tags:', error);
      setTagsMessage('Could not save your profile tags. Please try again.');
    } finally {
      setSavingTags(false);
    }
  };

  const logout = async () => {
    setSigningOut(true);
    setLogoutMessage('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setLogoutMessage(error.message);
        return;
      }

      router.replace('/');
    } catch (error) {
      console.error('Failed to sign out:', error);
      setLogoutMessage('Could not log out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const updateTheme = async (enabled: boolean) => {
    setSavingTheme(true);
    setAppearanceMessage('');
    try {
      await setMode(enabled ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save appearance preference:', error);
      setAppearanceMessage('Could not save your appearance preference. Please try again.');
    } finally {
      setSavingTheme(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={themeColor('#C96A13', mode, 'tintColor')}
            style={styles.backIcon}
          />
        </Pressable>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Make your space feel like yours</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.preferencesCard}>
          <PreferenceRow
            title="Dark theme"
            description="Black and orange; switch off for blue and white"
            enabled={mode === 'dark'}
            disabled={savingTheme || !themeReady}
            mode={mode}
            onValueChange={updateTheme}
          />
          {appearanceMessage || loadError ? (
            <Text style={styles.message}>{appearanceMessage || loadError}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your account</Text>
        <View style={styles.nameCard}>
          <Text style={styles.fieldLabel}>Player name</Text>
          <TextInput
            accessibilityLabel="Player name"
            autoCapitalize="words"
            maxLength={32}
            onChangeText={(value) => {
              setName(value);
              setNameMessage('');
            }}
            placeholder="Your player name"
            placeholderTextColor="#999999"
            returnKeyType="done"
            style={styles.nameInput}
            value={name}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save player name"
            disabled={savingName}
            onPress={saveName}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || savingName) && styles.pressed,
            ]}>
            <Text style={styles.saveButtonText}>{savingName ? 'Saving…' : 'Save name'}</Text>
          </Pressable>
          {nameMessage ? <Text style={styles.message}>{nameMessage}</Text> : null}
        </View>

        <View style={[styles.nameCard, { marginTop: 14 }]}>
          <Text style={styles.fieldLabel}>Profile tags</Text>
          <TextInput
            accessibilityLabel="Profile tags"
            autoCapitalize="none"
            maxLength={64}
            onChangeText={(value) => {
              setTags(value);
              setTagsMessage('');
            }}
            placeholder="#your teg"
            placeholderTextColor="#999999"
            returnKeyType="done"
            style={styles.nameInput}
            value={tags}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save profile tags"
            disabled={savingTags}
            onPress={saveTags}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || savingTags) && styles.pressed,
            ]}>
            <Text style={styles.saveButtonText}>{savingTags ? 'Saving…' : 'Save tags'}</Text>
          </Pressable>
          {tagsMessage ? <Text style={styles.message}>{tagsMessage}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.preferencesCard}>
          <PreferenceRow
            title="Challenge notifications"
            description="Keep challenge updates enabled"
            enabled={notificationsEnabled}
            disabled={!preferencesReady}
            mode={mode}
            onValueChange={(value) => updatePreference('notificationsEnabled', value)}
          />
          <View style={styles.divider} />
          <PreferenceRow
            title="Sound effects"
            description="Play sounds during battles"
            enabled={soundEnabled}
            disabled={!preferencesReady}
            mode={mode}
            onValueChange={(value) => updatePreference('soundEnabled', value)}
          />
          {settingsMessage ? <Text style={styles.message}>{settingsMessage}</Text> : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        disabled={signingOut}
        onPress={logout}
        style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}>
        <SymbolView
          name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
          size={20}
          tintColor="#B84235"
          style={styles.logoutIcon}
        />
        <Text style={styles.logoutText}>{signingOut ? 'Logging out…' : 'Log out'}</Text>
      </Pressable>
      {logoutMessage ? <Text style={styles.logoutMessage}>{logoutMessage}</Text> : null}
    </ScrollView>
  );
}

function PreferenceRow({
  title,
  description,
  enabled,
  disabled,
  mode,
  onValueChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  mode: ThemeMode;
  onValueChange: (value: boolean) => void;
}) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceText}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{
          false: themeColor('#444444', mode, 'backgroundColor'),
          true: themeColor('#F5B565', mode, 'backgroundColor'),
        }}
        thumbColor={themeColor(enabled ? '#F28C28' : '#AAA39A', mode)}
        style={styles.preferenceSwitch}
        value={enabled}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 72,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#29231D',
  },
  backIcon: {
    width: 22,
    height: 22,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    color: '#F3F0EB',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 3,
    color: '#AAA39A',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#F3F0EB',
    fontSize: 17,
    fontWeight: '700',
  },
  nameCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 22,
    backgroundColor: '#202020',
  },
  fieldLabel: {
    marginBottom: 8,
    color: '#AAA39A',
    fontSize: 13,
    fontWeight: '600',
  },
  nameInput: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 14,
    backgroundColor: '#171717',
    color: '#F3F0EB',
    fontSize: 16,
  },
  saveButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#F28C28',
  },
  saveButtonText: {
    color: '#171717',
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    marginTop: 9,
    color: '#F5A047',
    fontSize: 12,
    lineHeight: 17,
  },
  preferencesCard: {
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 22,
    backgroundColor: '#202020',
  },
  preferenceRow: {
    minHeight: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  preferenceText: {
    width: '100%',
  },
  preferenceSwitch: {
    alignSelf: 'flex-end',
    marginTop: -32,
  },
  preferenceTitle: {
    color: '#F3F0EB',
    fontSize: 14,
    fontWeight: '600',
  },
  preferenceDescription: {
    marginTop: 4,
    color: '#AAA39A',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#38302A',
  },
  logoutButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#63322D',
    borderRadius: 18,
    backgroundColor: '#2C1E1D',
  },
  logoutPressed: {
    opacity: 0.72,
  },
  logoutIcon: {
    width: 22,
    height: 22,
  },
  logoutText: {
    color: '#B84235',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutMessage: {
    marginTop: 9,
    color: '#B84235',
    fontSize: 12,
    textAlign: 'center',
  },
});
