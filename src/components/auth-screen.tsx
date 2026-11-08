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
import { supabase } from '@/lib/supabase';

type AuthScreenProps = {
  mode: 'login' | 'signup';
};

type AuthField = 'nickname' | 'email' | 'password' | 'repeatedPassword';
type AuthErrors = Partial<Record<AuthField, string>>;
type AuthMessage = { text: string; tone: 'error' | 'info' };

type AuthInputProps = {
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  error?: string;
  helperText?: string;
  onChangeText: (value: string) => void;
  value: string;
};

function AuthInput({
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
  helperText,
  onChangeText,
  value,
}: AuthInputProps) {
  return (
    <View>
      <TextInput
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#C5A988"
        returnKeyType="next"
        secureTextEntry={secureTextEntry}
        style={[styles.input, styles.inputText, error && styles.inputError]}
        value={value}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.passwordHint}>{helperText}</Text>
      ) : null}
    </View>
  );
}

function getAuthErrorMessage(error: { code?: string; message: string }, isSignup: boolean) {
  const details = `${error.code ?? ''} ${error.message}`.toLowerCase();

  if (details.includes('already registered') || details.includes('user_already_exists')) {
    return 'this email is already in use.';
  }
  if (
    details.includes('signup_disabled') ||
    details.includes('signups are disabled') ||
    details.includes('signups not allowed')
  ) {
    return 'new account sign up is turned off in supabase. enable “allow new users to sign up” in auth settings.';
  }
  if (
    details.includes('email provider is disabled') ||
    details.includes('email logins are disabled')
  ) {
    return 'the email provider is turned off in supabase. enable it in auth settings.';
  }
  if (details.includes('invalid login') || details.includes('invalid_credentials')) {
    return 'email or password does not match.';
  }
  if (details.includes('weak_password')) {
    return 'choose a stronger password and try again.';
  }
  if (details.includes('invalid email') || details.includes('email_address_invalid')) {
    return 'enter a valid email address.';
  }
  if (details.includes('database error saving new user')) {
    return 'supabase could not save this account. check your database triggers and auth logs.';
  }
  if (details.includes('rate limit') || details.includes('over_email_send_rate_limit')) {
    return 'too many attempts. wait a little and try again.';
  }

  const message = error.message.trim().replace(/\s+/g, ' ').toLowerCase();
  if (message) {
    return message.length > 120 ? `${message.slice(0, 117)}...` : message;
  }

  return isSignup
    ? 'could not create your account. please try again.'
    : 'could not log in. check your details and try again.';
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup';
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<AuthMessage | null>(null);
  const [fields, setFields] = useState({
    nickname: '',
    email: '',
    password: '',
    repeatedPassword: '',
  });
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(350, Math.max(0, width - 32));
  const cardHeight = Math.min(497, Math.max(0, height - 40));
  const updateField = (field: keyof typeof fields) => (value: string) => {
    setFields((currentFields) => ({ ...currentFields, [field]: value }));
    setAuthMessage(null);
  };
  const getValidationErrors = (): AuthErrors => {
    const errors: AuthErrors = {};
    if (isSignup && !fields.nickname.trim()) {
      errors.nickname = 'nickname is required.';
    }
    if (!fields.email.trim()) {
      errors.email = 'email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      errors.email = 'enter a valid email address.';
    }
    if (!fields.password) {
      errors.password = 'password is required.';
    } else if (fields.password.length < 8 || !/\d/.test(fields.password)) {
      errors.password = 'use at least 8 characters and 1 number.';
    }
    if (isSignup && !fields.repeatedPassword) {
      errors.repeatedPassword = 'please repeat your password.';
    } else if (isSignup && fields.repeatedPassword !== fields.password) {
      errors.repeatedPassword = 'passwords do not match.';
    }
    return errors;
  };
  const validationErrors = hasSubmitted ? getValidationErrors() : {};
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
  const handleNext = async () => {
    Keyboard.dismiss();
    setHasSubmitted(true);
    if (Object.keys(getValidationErrors()).length > 0) {
      return;
    }
    setIsLoading(true);
    setAuthMessage(null);

    try {
      const email = fields.email.trim();
      let nickname = isSignup ? fields.nickname.trim() : email.split('@')[0];

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: fields.password,
          options: { data: { nickname } },
        });

        if (error) {
          setAuthMessage({ text: getAuthErrorMessage(error, true), tone: 'error' });
          return;
        }

        if (!data.session) {
          setAuthMessage({
            text: 'email confirmation is on. turn off “confirm email” in supabase to sign up without verification.',
            tone: 'info',
          });
          return;
        }

        const savedNickname = data.user?.user_metadata.nickname;
        if (typeof savedNickname === 'string' && savedNickname.trim()) {
          nickname = savedNickname.trim();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: fields.password,
        });

        if (error) {
          setAuthMessage({ text: getAuthErrorMessage(error, false), tone: 'error' });
          return;
        }

        const savedNickname = data.user.user_metadata.nickname;
        if (typeof savedNickname === 'string' && savedNickname.trim()) {
          nickname = savedNickname.trim();
        }
      }

      router.replace({ pathname: '/feed', params: { nickname } });
    } catch (error) {
      console.error('Authentication request failed:', error);
      setAuthMessage({
        text: 'could not connect. check your internet and try again.',
        tone: 'error',
      });
    } finally {
      setIsLoading(false);
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
        <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
          <StatusBar hidden />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={dismiss}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>

          {isSignup ? (
            <>
              <View
                style={[
                  styles.signupFields,
                  hasValidationErrors && styles.signupFieldsWithErrors,
                ]}>
                <AuthInput
                  placeholder="nickname"
                  error={validationErrors.nickname}
                  onChangeText={updateField('nickname')}
                  value={fields.nickname}
                />
                <AuthInput
                  placeholder="email"
                  keyboardType="email-address"
                  error={validationErrors.email}
                  onChangeText={updateField('email')}
                  value={fields.email}
                />
                <AuthInput
                  placeholder="password"
                  secureTextEntry
                  error={validationErrors.password}
                  helperText={'at least 8 characters\nat least 1 digit (0-9)'}
                  onChangeText={updateField('password')}
                  value={fields.password}
                />
                <AuthInput
                  placeholder="repeat password"
                  secureTextEntry
                  error={validationErrors.repeatedPassword}
                  onChangeText={updateField('repeatedPassword')}
                  value={fields.repeatedPassword}
                />
              </View>
              {authMessage ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.authFeedback,
                    styles.signupAuthFeedback,
                    authMessage.tone === 'error' ? styles.authError : styles.authInfo,
                  ]}>
                  {authMessage.text}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={styles.loginFields}>
              <AuthInput
                placeholder="email"
                keyboardType="email-address"
                error={validationErrors.email}
                onChangeText={updateField('email')}
                value={fields.email}
              />
              <AuthInput
                placeholder="password"
                secureTextEntry
                error={validationErrors.password}
                onChangeText={updateField('password')}
                value={fields.password}
              />
              {authMessage ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.authFeedback,
                    authMessage.tone === 'error' ? styles.authError : styles.authInfo,
                  ]}>
                  {authMessage.text}
                </Text>
              ) : null}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isLoading ? 'Please wait' : isSignup ? 'Create account' : 'Log in'}
            accessibilityState={{ disabled: isLoading }}
            disabled={isLoading}
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextButton,
              (pressed || isLoading) && styles.pressed,
            ]}>
            <Text style={styles.nextText}>{isLoading ? 'working...' : 'next'}</Text>
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
    maxWidth: 350,
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
    top: '17.5%',
    left: '10%',
    width: '80%',
    gap: 25,
  },
  signupFieldsWithErrors: {
    gap: 8,
  },
  loginFields: {
    position: 'absolute',
    top: '17.5%',
    left: '10%',
    width: '80%',
    gap: 25,
  },
  input: {
    height: 45,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFF2EB',
    fontSize: 18,
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  inputError: {
    borderBottomColor: '#D47A62',
    borderBottomWidth: 2,
  },
  inputText: {
    color: '#E9803F',
  },
  errorText: {
    marginTop: 4,
    marginLeft: 10,
    color: '#B84A32',
    fontSize: 14,
    lineHeight: 18,
  },
  passwordHint: {
    marginLeft: 16,
    color: '#C4C4C4',
    fontSize: 13,
    lineHeight: 21,
  },
  authFeedback: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: '#FFF2EB',
    fontSize: 13,
    lineHeight: 18,
  },
  signupAuthFeedback: {
    position: 'absolute',
    right: '8%',
    bottom: '12%',
    left: '8%',
    textAlign: 'center',
  },
  authError: {
    borderColor: '#E8B4A7',
    color: '#A23A1B',
  },
  authInfo: {
    borderColor: '#FFD3A9',
    color: '#A23A1B',
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
