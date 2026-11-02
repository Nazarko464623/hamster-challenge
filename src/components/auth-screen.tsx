import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
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
  onChangeText: (value: string) => void;
};

function AuthInput({ placeholder, keyboardType, secureTextEntry, onChangeText }: AuthInputProps) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      autoCapitalize="none"
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#C5A988"
      returnKeyType="next"
      secureTextEntry={secureTextEntry}
      style={[styles.input, styles.inputText]}
    />
  );
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup';
  const [rememberMe, setRememberMe] = useState(false);
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
  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
  const handleNext = () => {
    const requiredFields = isSignup
      ? [fields.nickname, fields.email, fields.password, fields.repeatedPassword]
      : [fields.email, fields.password];

    if (requiredFields.some((value) => !value.trim())) {
      Alert.alert('Missing information', 'Please fill in all fields to continue.');
      return;
    }

    if (isSignup && fields.password !== fields.repeatedPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password in both password fields.');
      return;
    }

    Keyboard.dismiss();
    router.replace('/feed');
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
              <View style={styles.signupFields}>
                <AuthInput placeholder="nickname" onChangeText={updateField('nickname')} />
                <AuthInput
                  placeholder="email"
                  keyboardType="email-address"
                  onChangeText={updateField('email')}
                />
                <View>
                  <AuthInput
                    placeholder="password"
                    secureTextEntry
                    onChangeText={updateField('password')}
                  />
                  <Text style={styles.passwordHint}>at least 8 characters</Text>
                  <Text style={styles.passwordHint}>at least 1 digit (0-9)</Text>
                </View>
                <AuthInput
                  placeholder="repeat password"
                  secureTextEntry
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
                onChangeText={updateField('email')}
              />
              <AuthInput
                placeholder="password"
                secureTextEntry
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
  inputText: {
    color: '#E9803F',
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
