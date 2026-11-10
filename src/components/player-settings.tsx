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
import { getPlayerPreferences, savePlayerPreferences } from '@/lib/player-settings';
import { supabase } from '@/lib/supabase';

type PlayerSettingsProps = {
  displayName: string;
  onClose: () => void;
  onNameSaved: (name: string) => void;
};

export function PlayerSettings({ displayName, onClose, onNameSaved }: PlayerSettingsProps) {
  const [name, setName] = useState(displayName);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [logoutMessage, setLogoutMessage] = useState('');
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
            tintColor="#9B592E"
            style={styles.backIcon}
          />
        </Pressable>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Make your space feel like yours</Text>
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
            placeholderTextColor="#B29B88"
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.preferencesCard}>
          <PreferenceRow
            title="Challenge notifications"
            description="Keep challenge updates enabled"
            enabled={notificationsEnabled}
            disabled={!preferencesReady}
            onValueChange={(value) => updatePreference('notificationsEnabled', value)}
          />
          <View style={styles.divider} />
          <PreferenceRow
            title="Sound effects"
            description="Play sounds during battles"
            enabled={soundEnabled}
            disabled={!preferencesReady}
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
  onValueChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
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
        trackColor={{ false: '#E5D8CD', true: '#F6B27E' }}
        thumbColor={enabled ? '#E9803F' : '#FFFDFB'}
        style={styles.preferenceSwitch}
        value={enabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#FFF0E4',
  },
  backIcon: {
    width: 22,
    height: 22,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    color: '#44372F',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 3,
    color: '#9B8774',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#44372F',
    fontSize: 17,
    fontWeight: '700',
  },
  nameCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3D6BE',
    borderRadius: 22,
    backgroundColor: '#FFFAF6',
  },
  fieldLabel: {
    marginBottom: 8,
    color: '#8D735F',
    fontSize: 13,
    fontWeight: '600',
  },
  nameInput: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EAD6C5',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#44372F',
    fontSize: 16,
  },
  saveButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#E9803F',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    marginTop: 9,
    color: '#8A4B2B',
    fontSize: 12,
    lineHeight: 17,
  },
  preferencesCard: {
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3D6BE',
    borderRadius: 22,
    backgroundColor: '#FFFAF6',
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
    color: '#5D4635',
    fontSize: 14,
    fontWeight: '600',
  },
  preferenceDescription: {
    marginTop: 4,
    color: '#9B8774',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0E2D6',
  },
  logoutButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#F0C7BD',
    borderRadius: 18,
    backgroundColor: '#FFF5F2',
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
