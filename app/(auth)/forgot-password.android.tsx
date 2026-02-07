import React, { useState } from 'react';
import {
  View,
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Check your email for the reset link!');
      router.replace('/(auth)/login');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: m3.background }}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <RNPText variant="headlineMedium" style={{ color: m3.onBackground, textAlign: 'center' }}>
            Reset Password
          </RNPText>
          <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
            Enter your email and we'll send you a link to reset your password.
          </RNPText>

          <Surface style={[styles.form, { backgroundColor: m3.inverseOnSurface }]} elevation={1}>
            <View>
              <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>Email</RNPText>
              <RNPTextInput
                mode="outlined"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="name@example.com"
              />
            </View>

            <Button
              mode="contained"
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
              buttonColor={m3.primary}
              textColor={m3.onPrimary}
            >
              Send Reset Link
            </Button>

            <Button
              mode="text"
              onPress={() => router.push('/(auth)/login')}
              textColor={m3.primary}
            >
              Back to Login
            </Button>
          </Surface>
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
});
