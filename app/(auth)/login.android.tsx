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
import { useTheme } from '@/contexts/theme-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Button, Surface, Text as RNPText } from 'react-native-paper';

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
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
      } else {
        router.replace('/security-verification?justLoggedIn=true');
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    Alert.alert('Google Login', 'Configure Google Cloud Console & Supabase first.');
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
              Welcome Back
            </RNPText>
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
              Log in to HLT Messenger to connect with your friends.
            </RNPText>
          </View>

          <Surface style={[styles.card, { backgroundColor: m3.surface }]} elevation={1}>
            <View style={styles.formContainer}>
              <View>
                <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>Email</RNPText>
                <TextInput
                  style={[styles.input, { color: m3.onSurface, backgroundColor: m3.surfaceContainerHighest, borderColor: m3.outline }]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </View>

              <View>
                <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>Password</RNPText>
                <TextInput
                  style={[styles.input, { color: m3.onSurface, backgroundColor: m3.surfaceContainerHighest, borderColor: m3.outline }]}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </View>

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={[styles.button, { backgroundColor: m3.primary }]}
                labelStyle={{ color: m3.onPrimary }}
              >
                Log In
              </Button>

              <TouchableOpacity
                style={styles.centerContainer}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <RNPText variant="bodyMedium" style={{ color: m3.primary }}>Forgot Password?</RNPText>
              </TouchableOpacity>
            </View>
          </Surface>

          <View style={styles.separatorContainer}>
            <View style={[styles.separator, { backgroundColor: m3.outline }]} />
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginHorizontal: 10 }}>OR</RNPText>
            <View style={[styles.separator, { backgroundColor: m3.outline }]} />
          </View>

          <Button
            mode="outlined"
            onPress={handleGoogleLogin}
            style={[styles.outlineButton, { borderColor: m3.outline }]}
            labelStyle={{ color: m3.onSurface }}
            icon="google"
          >
            Continue with Google
          </Button>

          <View style={styles.footerContainer}>
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant }}>Don't have an account?</RNPText>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <RNPText variant="bodyMedium" style={{ color: m3.primary, fontWeight: 'bold' }}>Sign Up</RNPText>
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
    marginTop: 8,
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
  outlineButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
});
