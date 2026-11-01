import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  useWindowDimensions,
} from 'react-native';

import { welcomeBlurTarget } from './auth-blur-target';

type AuthScreenProps = {
  mode: 'login' | 'signup';
};

type AuthInputProps = {
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
};

function AuthInput({ placeholder, keyboardType, secureTextEntry }: AuthInputProps) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      autoCapitalize="none"
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor="#C5A988"
      returnKeyType="next"
      secureTextEntry={secureTextEntry}
      style={styles.input}
    />
  );
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup';
  const [rememberMe, setRememberMe] = useState(false);
  const { width, height } = useWindowDimensions();
  const cardHeight = Math.min(570, height * 0.72);
  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.backdrop}>
      <BlurView
        blurTarget={welcomeBlurTarget}
        intensity={55}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint="dark"
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
        onPress={dismiss}
        style={styles.dismissOverlay}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
        style={styles.cardPositioner}>
        <View style={[styles.card, { height: cardHeight }]}>
          <StatusBar hidden />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={dismiss}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>

          {isSignup ? (
            <View style={styles.signupFields}>
              <AuthInput placeholder="nickname" />
              <AuthInput placeholder="email" keyboardType="email-address" />
              <View>
                <AuthInput placeholder="password" secureTextEntry />
                <Text style={styles.passwordHint}>at least 8 characters</Text>
                <Text style={styles.passwordHint}>at least 1 digit (0-9)</Text>
              </View>
              <AuthInput placeholder="repeat password" secureTextEntry />
            </View>
          ) : (
            <View style={styles.loginFields}>
              <AuthInput placeholder="email" keyboardType="email-address" />
              <AuthInput placeholder="password" secureTextEntry />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Remember me"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe((checked) => !checked)}
                style={styles.rememberRow}>
                <View style={[styles.checkbox, rememberMe && styles.checkedCheckbox]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>remember me</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            onPress={Keyboard.dismiss}
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}>
            <Text style={styles.nextText}>next</Text>
            <Text style={styles.nextArrow}>›</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  cardPositioner: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    top: 30,
    left: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  backArrow: {
    marginTop: -4,
    color: '#F47724',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 40,
  },
  signupFields: {
    position: 'absolute',
    top: '17.2%',
    left: '10%',
    width: '80%',
    gap: 25,
  },
  loginFields: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: '80%',
    gap: 30,
  },
  input: {
    height: 45,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFF2EB',
    color: '#A99178',
    fontSize: 18,
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  passwordHint: {
    marginLeft: 16,
    color: '#C4C4C4',
    fontSize: 13,
    lineHeight: 21,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: -12,
    marginLeft: 6,
  },
  checkbox: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFF2EB',
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  checkedCheckbox: {
    backgroundColor: '#F98C3E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  rememberText: {
    color: '#C5A988',
    fontSize: 18,
  },
  nextButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: 90,
    height: 40,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  nextText: {
    color: '#E9803F',
    fontSize: 16,
  },
  nextArrow: {
    marginTop: -3,
    color: '#F47724',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },
  pressed: {
    opacity: 0.7,
  },
});
