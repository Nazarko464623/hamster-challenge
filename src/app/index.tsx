import { BlurTargetView } from 'expo-blur';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { welcomeBlurTarget } from '@/components/auth-blur-target';

export default function WelcomeScreen() {
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
          style={({ pressed }) => [styles.button, styles.signUpButton, pressed && styles.pressed]}>
          <Text style={styles.signUpText}>Sign up</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.button, styles.logInButton, pressed && styles.pressed]}>
          <Text style={styles.logInText}>Log in</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    borderColor: '#F98C3E',
    shadowColor: '#785943',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  signUpButton: {
    backgroundColor: '#FFD3A9',
  },
  logInButton: {
    backgroundColor: '#FFF2EB',
  },
  signUpText: {
    color: '#A23A1B',
    fontSize: 20,
  },
  logInText: {
    color: '#F98C3E',
    fontSize: 20,
  },
  pressed: {
    opacity: 0.75,
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
    color: '#2188F7',
  },
  productionLogo: {
    position: 'absolute',
    bottom: '1%',
    width: 140,
    height: 51,
  },
});
