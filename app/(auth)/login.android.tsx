import React, { useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  TouchableOpacity,
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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme, isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.login.errors.missingFields'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert(t('auth.login.errors.loginFailedTitle'), error.message);
      } else {
        router.replace('/security-verification?justLoggedIn=true');
      }
    } catch (error: any) {
      Alert.alert(
        t('auth.login.errors.loginErrorTitle'),
        error.message || t('auth.login.errors.loginErrorFallback')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    Alert.alert(t('auth.login.errors.googleTitle'), t('auth.login.errors.googleMessage'));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: m3.background }}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <RNPText variant="headlineMedium" style={{ color: m3.onBackground, textAlign: 'center' }}>
              {t('auth.login.title')}
            </RNPText>
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
              {t('auth.login.subtitle')}
            </RNPText>
          </View>

          <Surface style={[styles.card, { backgroundColor: m3.inverseOnSurface }]} elevation={1}>
            <View style={styles.formContainer}>
              <View>
                <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>{t('auth.login.emailLabel')}</RNPText>
                <RNPTextInput
                  mode="outlined"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.login.emailPlaceholder')}
                />
              </View>

              <View>
                <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>{t('auth.login.passwordLabel')}</RNPText>
                <RNPTextInput
                  mode="outlined"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.login.passwordPlaceholder')}
                />
              </View>

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                buttonColor={m3.primary}
                textColor={m3.onPrimary}
              >
                {t('auth.login.button')}
              </Button>

              <TouchableOpacity
                style={styles.centerContainer}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <RNPText variant="bodyMedium" style={{ color: m3.primary }}>{t('auth.login.forgotPassword')}</RNPText>
              </TouchableOpacity>
            </View>
          </Surface>

          <View style={styles.separatorContainer}>
            <View style={[styles.separator, { backgroundColor: m3.outline }]} />
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginHorizontal: 10 }}>{t('auth.login.or')}</RNPText>
            <View style={[styles.separator, { backgroundColor: m3.outline }]} />
          </View>

          <Button
            mode="outlined"
            onPress={handleGoogleLogin}
            icon="google"
            textColor={m3.onSurface}
          >
            {t('auth.login.google')}
          </Button>

          <View style={styles.footerContainer}>
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant }}>{t('auth.login.footer')}</RNPText>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <RNPText variant="bodyMedium" style={{ color: m3.primary, fontWeight: 'bold' }}>{t('auth.login.footerAction')}</RNPText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  contentContainer: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    gap: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  formContainer: {
    gap: 16,
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    flex: 1,
    height: 1,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
});
