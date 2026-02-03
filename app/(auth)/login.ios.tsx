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
import { supabase } from '../../src/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { Host, Button } from '@expo/ui/swift-ui';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();

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
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: theme.tabIconDefault }]}>
              Log in to HLT Messenger to connect with your friends.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.formContainer}>
              <View>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>

              <View>
                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>

              <Host style={styles.buttonHost}>
                <Button
                  onPress={handleLogin}
                  disabled={loading}
                  variant="glassProminent"
                >
                  {loading ? 'Logging in...' : 'Log In'}
                </Button>
              </Host>

              <TouchableOpacity
                style={styles.centerContainer}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={{ color: theme.tint }}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.separatorContainer}>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <Text style={{ color: theme.tabIconDefault, marginHorizontal: 10 }}>OR</Text>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: theme.border }]}
            onPress={handleGoogleLogin}
          >
            <Ionicons name="logo-google" size={20} color={theme.text} style={{ marginRight: 10 }} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.footerContainer}>
            <Text style={{ color: theme.tabIconDefault }}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={{ color: theme.tint, fontWeight: 'bold' }}>Sign Up</Text>
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
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  formContainer: {
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  buttonHost: {
    height: 50,
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
});
