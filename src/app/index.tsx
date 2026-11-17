import { BlurTargetView } from 'expo-blur';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { welcomeBlurTarget } from '@/components/auth-blur-target';
import { useThemedStyles } from '@/components/app-theme-provider';
import { supabase } from '@/lib/supabase';

export default function WelcomeScreen() {
  const styles = useThemedStyles(baseStyles);
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to restore Supabase session:', error);
        return;
      }

      if (data.session) {
        const metadataNickname = data.session.user.user_metadata.nickname;
        const nickname =
          typeof metadataNickname === 'string' && metadataNickname.trim()
            ? metadataNickname.trim()
            : data.session.user.email?.split('@')[0] ?? 'Player';

        router.replace({ pathname: '/feed', params: { nickname } });
      }
    }).catch((error: unknown) => {
      if (isMounted) {
        console.error('Failed to restore Supabase session:', error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <BlurTargetView ref={welcomeBlurTarget} style={styles.container}>
      <StatusBar hidden />

      <Image
        accessibilityLabel="HamstBattle hamster logo"
        contentFit="contain"
        source={require('@/assets/images/hamster-logo.png')}
        style={styles.hamsterLogo}
      />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign up"
          onPress={() => router.push('/signup')}
          style={({ pressed }) => [
            styles.button,
            styles.signUpButton,
            pressed && styles.pressedButton,
          ]}>
          {({ pressed }) => (
            <Text style={[styles.signUpText, pressed && styles.pressedButtonText]}>Sign up</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={() => router.push('/login')}
          style={({ pressed }) => [
            styles.button,
            styles.logInButton,
            pressed && styles.pressedButton,
          ]}>
          {({ pressed }) => (
            <Text style={[styles.logInText, pressed && styles.pressedButtonText]}>Log in</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.legalText}>
        By continuing, you agree to the <Text style={styles.legalLink}>Terms of Use</Text>
        {'\n'}and <Text style={styles.legalLink}>Privacy Policy</Text>
      </Text>

      <Image
        accessibilityLabel="JoPa production"
        contentFit="contain"
        source={require('@/assets/images/jopa-production.png')}
        style={styles.productionLogo}
      />
    </BlurTargetView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#171717',
  },
  hamsterLogo: {
    position: 'absolute',
    top: '26%',
    width: 266,
    height: 193,
  },
  actions: {
    position: 'absolute',
    top: '59.8%',
    width: '64%',
    gap: 18,
  },
  button: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F28C28',
    shadowColor: '#4A4A4A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  signUpButton: {
    backgroundColor: '#332416',
  },
  logInButton: {
    backgroundColor: '#222222',
  },
  signUpText: {
    color: '#F3F0EB',
    fontSize: 20,
  },
  logInText: {
    color: '#F28C28',
    fontSize: 20,
  },
  pressedButton: {
    backgroundColor: '#F28C28',
  },
  pressedButtonText: {
    color: '#171717',
  },
  legalText: {
    position: 'absolute',
    bottom: '7.7%',
    width: '100%',
    color: '#8D8D8D',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLink: {
    color: '#F28C28',
  },
  productionLogo: {
    position: 'absolute',
    bottom: '1%',
    width: 140,
    height: 51,
  },
});
