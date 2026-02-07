import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useTheme } from '@/contexts/theme-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Button, Surface, Text as RNPText, TextInput as RNPTextInput } from 'react-native-paper';
import { t } from '@/services/i18n';

export default function SignUpScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), t('auth.signup.errors.missingFields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.signup.errors.passwordMismatch'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert(t('auth.signup.errors.signUpFailedTitle'), error.message);
    } else {
      Alert.alert(t('auth.signup.successTitle'), t('auth.signup.successMessage'));
      router.replace('/(auth)/login');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: m3.background }}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <RNPText variant="headlineMedium" style={{ color: m3.onBackground, textAlign: 'center' }}>
            {t('auth.signup.title')}
          </RNPText>
          <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
            {t('auth.signup.subtitle')}
          </RNPText>

          <Surface style={[styles.form, { backgroundColor: m3.inverseOnSurface }]} elevation={1}>
            <View>
              <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>{t('auth.signup.emailLabel')}</RNPText>
              <RNPTextInput
                mode="outlined"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t('auth.signup.emailPlaceholder')}
              />
            </View>

            <View>
              <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>{t('auth.signup.passwordLabel')}</RNPText>
              <RNPTextInput
                mode="outlined"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.signup.passwordPlaceholder')}
              />
            </View>

            <View>
              <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>{t('auth.signup.confirmPasswordLabel')}</RNPText>
              <RNPTextInput
                mode="outlined"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.signup.confirmPasswordPlaceholder')}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              buttonColor={m3.primary}
              textColor={m3.onPrimary}
            >
              {t('auth.signup.button')}
            </Button>
          </Surface>

          <View style={styles.footer}>
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant }}>{t('auth.signup.footer')}</RNPText>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <RNPText variant="bodyMedium" style={{ color: m3.primary, fontWeight: 'bold' }}>{t('auth.signup.footerAction')}</RNPText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    gap: 20,
  },
  form: {
    gap: 16,
    padding: 20,
    borderRadius: 16,
    marginTop: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
});
