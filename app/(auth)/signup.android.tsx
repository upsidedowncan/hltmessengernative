import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useTheme } from '../../src/context/ThemeContext';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Button, Surface, Text as RNPText } from 'react-native-paper';

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
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else {
      Alert.alert('Success', 'Check your email for confirmation!');
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
            Create Account
          </RNPText>
          <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
            Join HLT Messenger and start chatting with your friends.
          </RNPText>

          <Surface style={[styles.form, { backgroundColor: m3.surface }]} elevation={1}>
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
                placeholder="Create a password"
                placeholderTextColor={m3.onSurfaceVariant}
              />
            </View>

            <View>
              <RNPText variant="labelMedium" style={{ color: m3.onSurface, marginBottom: 6 }}>Confirm Password</RNPText>
              <TextInput
                style={[styles.input, { color: m3.onSurface, backgroundColor: m3.surfaceContainerHighest, borderColor: m3.outline }]}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat your password"
                placeholderTextColor={m3.onSurfaceVariant}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              style={[styles.button, { backgroundColor: m3.primary }]}
              labelStyle={{ color: m3.onPrimary }}
            >
              Sign Up
            </Button>
          </Surface>

          <View style={styles.footer}>
            <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant }}>Already have an account?</RNPText>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <RNPText variant="bodyMedium" style={{ color: m3.primary, fontWeight: 'bold' }}>Log In</RNPText>
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
