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

type AuthField = 'nickname' | 'email' | 'password' | 'repeatedPassword';
type AuthErrors = Partial<Record<AuthField, string>>;

type AuthInputProps = {
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  error?: string;
  helperText?: string;
  onChangeText: (value: string) => void;
};

function AuthInput({
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
  helperText,
  onChangeText,
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

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup';
  const [rememberMe, setRememberMe] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
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
  };
  const getValidationErrors = (): AuthErrors => {
    const errors: AuthErrors = {};
    if (isSignup && !fields.nickname.trim()) {
      errors.nickname = 'Nickname is required.';
    }
    if (!fields.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!fields.password) {
      errors.password = 'Password is required.';
    } else if (fields.password.length < 8 || !/\d/.test(fields.password)) {
      errors.password = 'Password does not meet the requirements.';
    }
    if (isSignup && !fields.repeatedPassword) {
      errors.repeatedPassword = 'Please repeat your password.';
    } else if (isSignup && fields.repeatedPassword !== fields.password) {
      errors.repeatedPassword = 'Passwords do not match.';
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
  const handleNext = () => {
    Keyboard.dismiss();
    setHasSubmitted(true);
    if (Object.keys(getValidationErrors()).length > 0) {
      return;
    }
    router.replace({
      pathname: '/feed',
      params: {
        nickname: isSignup ? fields.nickname.trim() : fields.email.trim().split('@')[0],
      },
    });
  };
  const rememberMeRow = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Remember me"
      accessibilityState={{ checked: rememberMe }}
      onPress={() => setRememberMe((checked) => !checked)}
      style={[styles.rememberRow, isSignup && styles.signupRememberRow]}>
      <View style={[styles.checkbox, rememberMe && styles.checkedCheckbox]}>
        {rememberMe && <View style={styles.checkboxIndicator} />}
      </View>
      <Text style={[styles.rememberText, rememberMe && styles.checkedRememberText]}>
        remember me
      </Text>
    </Pressable>
  );

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
                />
                <AuthInput
                  placeholder="email"
                  keyboardType="email-address"
                  error={validationErrors.email}
                  onChangeText={updateField('email')}
                />
                <AuthInput
                  placeholder="password"
                  secureTextEntry
                  error={validationErrors.password}
                  helperText={'at least 8 characters\nat least 1 digit (0-9)'}
                  onChangeText={updateField('password')}
                />
                <AuthInput
                  placeholder="repeat password"
                  secureTextEntry
                  error={validationErrors.repeatedPassword}
                  onChangeText={updateField('repeatedPassword')}
                />
              </View>
              {rememberMeRow}
            </>
          ) : (
            <View style={styles.loginFields}>
              <AuthInput
                placeholder="email"
                keyboardType="email-address"
                error={validationErrors.email}
                onChangeText={updateField('email')}
              />
              <AuthInput
                placeholder="password"
                secureTextEntry
                error={validationErrors.password}
                onChangeText={updateField('password')}
              />
              {rememberMeRow}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            onPress={handleNext}
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
    borderBottomColor: '#FF2D2D',
    borderBottomWidth: 2,
  },
  inputText: {
    color: '#E9803F',
  },
  errorText: {
    marginTop: 4,
    marginLeft: 10,
    color: '#FF2D2D',
    fontSize: 14,
    lineHeight: 18,
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
    marginTop: -6,
    marginLeft: 6,
  },
  signupRememberRow: {
    position: 'absolute',
    left: '11.5%',
    bottom: '14%',
    marginTop: 0,
    marginLeft: 0,
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
    backgroundColor: '#FFF2EB',
  },
  checkboxIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F98C3E',
  },
  rememberText: {
    color: '#C5A988',
    fontSize: 18,
  },
  checkedRememberText: {
    color: '#E9803F',
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
