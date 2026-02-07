import React, { useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { t } from '@/services/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();

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
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{t('auth.login.title')}</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>
              {t('auth.login.subtitle')}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.formContainer}>
              <View>
                <Text style={[styles.label, { color: theme.text }]}>{t('auth.login.emailLabel')}</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.login.emailPlaceholder')}
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>

              <View>
                <Text style={[styles.label, { color: theme.text }]}>{t('auth.login.passwordLabel')}</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.tint, opacity: loading ? 0.7 : 1 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.login.button')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.centerContainer}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={{ color: theme.tint }}>{t('auth.login.forgotPassword')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.separatorContainer}>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <Text style={{ opacity: 0.5, marginHorizontal: 10, color: theme.text }}>{t('auth.login.or')}</Text>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: theme.border }]}
            onPress={handleGoogleLogin}
          >
            <Ionicons name="logo-google" size={20} color={theme.text} style={{ marginRight: 10 }} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>{t('auth.login.google')}</Text>
          </TouchableOpacity>

          <View style={styles.footerContainer}>
            <Text style={{ opacity: 0.7, color: theme.text }}>{t('auth.login.footer')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={{ color: theme.tint, fontWeight: 'bold' }}>{t('auth.login.footerAction')}</Text>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  formContainer: {
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginLeft: 4,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
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
