import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
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
import { themeColor, useAppTheme, useThemedStyles } from '@/components/app-theme-provider';
import { getEmailSuggestions, hasInvalidEmailChars, isValidEmail } from '@/lib/email-domains';
import { LEGAL_VERSION } from '@/lib/legal';
import { supabase } from '@/lib/supabase';

type AuthScreenProps = {
  mode: 'login' | 'signup';
};

type AuthField = 'nickname' | 'email' | 'password' | 'repeatedPassword' | 'terms';
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
  suggestEmails?: boolean;
};

function AuthInput({
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
  helperText,
  onChangeText,
  value,
  suggestEmails,
}: AuthInputProps) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
    }
  }, []);
  const suggestions = suggestEmails && isFocused ? getEmailSuggestions(value) : [];
  const dropdownHeight = suggestions.length * SUGGESTION_ROW_HEIGHT + 8;
  return (
    <View
      // Android (new architecture) "flattens" a View that has no style of its own. When the
      // list appeared, the wrapper got a style, Android created it on the spot and moved the
      // input into it: the input lost focus and the cursor jumped to the nickname field.
      // collapsable={false} and a style that is always present keep the wrapper in place.
      collapsable={false}
      style={[
        suggestEmails && styles.inputWithSuggestions,
        // When the list is open the wrapper is stretched over it (and pulled back with a
        // negative margin so nothing below moves). On Android a tap only reaches a view
        // that lies inside its parent's bounds.
        suggestions.length > 0 && {
          paddingBottom: dropdownHeight + 4,
          marginBottom: -(dropdownHeight + 4),
        },
      ]}>
      <TextInput
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={suggestEmails ? false : undefined}
        keyboardType={keyboardType}
        onBlur={() => {
          // On web the input loses focus before the click on a suggestion lands,
          // so the list is hidden a moment later instead of immediately.
          blurTimer.current = setTimeout(() => setIsFocused(false), 300);
        }}
        onChangeText={onChangeText}
        onFocus={() => {
          if (blurTimer.current) {
            clearTimeout(blurTimer.current);
          }
          setIsFocused(true);
        }}
        placeholder={placeholder}
        placeholderTextColor={themeColor('#999999', mode)}
        returnKeyType="next"
        secureTextEntry={secureTextEntry}
        style={[styles.input, styles.inputText, error && styles.inputError]}
        value={value}
      />
      {suggestions.length > 0 ? (
        <View accessibilityRole="menu" style={[styles.suggestionList, { height: dropdownHeight }]}>
          {suggestions.map((suggestion) => {
            const atIndex = suggestion.indexOf('@');
            return (
              <Pressable
                key={suggestion}
                accessibilityRole="menuitem"
                accessibilityLabel={`Use ${suggestion}`}
                onPress={() => onChangeText(suggestion)}
                style={({ pressed }) => [styles.suggestionItem, pressed && styles.suggestionPressed]}>
                <Text numberOfLines={1} style={styles.suggestionText}>
                  {suggestion.slice(0, atIndex + 1)}
                  <Text style={styles.suggestionDomain}>{suggestion.slice(atIndex + 1)}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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

const SUGGESTION_ROW_HEIGHT = 36;
const latinOnlyEmailError = 'use latin letters only (a-z), switch your keyboard to english.';

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
  const styles = useThemedStyles(baseStyles);
  const { mode: themeMode } = useAppTheme();
  const isDark = themeMode === 'dark';
  const isSignup = mode === 'signup';
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<AuthMessage | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    } else if (hasInvalidEmailChars(fields.email)) {
      errors.email = latinOnlyEmailError;
    } else if (!isValidEmail(fields.email)) {
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
    if (isSignup && !acceptedTerms) {
      errors.terms = 'accept the terms to continue.';
    }
    return errors;
  };
  const validationErrors: AuthErrors = hasSubmitted ? getValidationErrors() : {};
  if (!validationErrors.email && hasInvalidEmailChars(fields.email)) {
    // Shown while typing, before "next" is pressed, so Cyrillic is caught at once.
    validationErrors.email = latinOnlyEmailError;
  }
  // The terms checkbox shows its own hint, so it should not squeeze the input fields.
  const hasValidationErrors = Object.keys(validationErrors).some((field) => field !== 'terms');
  const openLegal = (pathname: '/terms' | '/privacy') => {
    Keyboard.dismiss();
    router.push(pathname);
  };
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
          options: {
            data: {
              nickname,
              terms_version: LEGAL_VERSION,
              terms_accepted_at: new Date().toISOString(),
            },
          },
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
        intensity={Platform.OS === 'android' ? 35 : 45}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint={isDark ? 'dark' : 'light'}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
        onPress={dismiss}
        style={[styles.dismissOverlay, isDark && styles.darkDismissOverlay]}
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
                  suggestEmails
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
              <View style={styles.consentRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
                  accessibilityState={{ checked: acceptedTerms }}
                  hitSlop={8}
                  onPress={() => {
                    setAcceptedTerms((accepted) => !accepted);
                    setAuthMessage(null);
                  }}
                  style={[
                    styles.checkbox,
                    acceptedTerms && styles.checkboxChecked,
                    validationErrors.terms && styles.checkboxError,
                  ]}>
                  {acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </Pressable>
                <Text style={[styles.consentText, validationErrors.terms && styles.consentTextError]}>
                  I agree to the{' '}
                  <Text
                    accessibilityRole="link"
                    onPress={() => openLegal('/terms')}
                    style={styles.consentLink}>
                    Terms of Use
                  </Text>{' '}
                  and{' '}
                  <Text
                    accessibilityRole="link"
                    onPress={() => openLegal('/privacy')}
                    style={styles.consentLink}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.loginFields}>
              <AuthInput
                placeholder="email"
                keyboardType="email-address"
                suggestEmails
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

const baseStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  darkDismissOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
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
    backgroundColor: '#171717',
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
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  backArrow: {
    marginTop: -4,
    color: '#FFAA45',
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
    minHeight: 210,
    gap: 25,
  },
  input: {
    height: 45,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#222222',
    fontSize: 18,
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  inputWithSuggestions: {
    zIndex: 10,
    elevation: 10,
  },
  suggestionList: {
    position: 'absolute',
    top: 49,
    right: 0,
    left: 0,
    overflow: 'hidden',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 18,
    backgroundColor: '#222222',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  suggestionItem: {
    height: SUGGESTION_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  suggestionPressed: {
    backgroundColor: '#393939',
  },
  suggestionText: {
    color: '#D2CCC4',
    fontSize: 15,
  },
  suggestionDomain: {
    color: '#F28C28',
    fontWeight: '600',
  },
  consentRow: {
    position: 'absolute',
    left: 22,
    right: 124,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#777777',
    borderRadius: 7,
    backgroundColor: '#222222',
  },
  checkboxChecked: {
    borderColor: '#F28C28',
    backgroundColor: '#F28C28',
  },
  checkboxError: {
    borderColor: '#D47A62',
  },
  checkboxMark: {
    marginTop: -1,
    color: '#171717',
    fontSize: 14,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    color: '#D2CCC4',
    fontSize: 12,
    lineHeight: 16,
  },
  consentTextError: {
    color: '#D47A62',
  },
  consentLink: {
    color: '#F28C28',
    textDecorationLine: 'underline',
  },
  inputError: {
    borderBottomColor: '#D47A62',
    borderBottomWidth: 2,
  },
  inputText: {
    color: '#F28C28',
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
    backgroundColor: '#222222',
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
    borderColor: '#63322D',
    color: '#F3F0EB',
  },
  authInfo: {
    borderColor: '#49321F',
    color: '#F3F0EB',
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
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  nextText: {
    color: '#F28C28',
    fontSize: 16,
  },
  nextArrow: {
    marginTop: -3,
    color: '#FFAA45',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },
  pressed: {
    opacity: 0.7,
  },
});
