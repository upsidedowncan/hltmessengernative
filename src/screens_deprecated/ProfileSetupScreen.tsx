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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useAppTheme } from '../context/FeatureFlagContext';

export const ProfileSetupScreen = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const { theme } = useAppTheme();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long.');
      return;
    }
    if (!fullName) {
        Alert.alert('Error', 'Please enter a display name.');
        return;
    }

    setLoading(true);

    try {
      // Call the RPC to upsert the profile
      const { error } = await supabase.rpc('upsert_profile', {
        new_username: username,
        new_full_name: fullName,
        new_avatar_url: null
      });

      if (error) {
        // Handle specific unique constraint error for username if needed
        if (error.message.includes('unique constraint')) {
            throw new Error('Username already taken. Please choose another.');
        }
        throw error;
      }

      await refreshProfile(); 
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Complete Your Profile</Text>
          <Text style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            Choose a unique username and a display name so friends can find you.
          </Text>

          <View style={styles.form}>
            <View>
              <Text style={[styles.label, { color: theme.text }]}>Username</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                placeholderTextColor={theme.tabIconDefault}
                autoCapitalize="none"
              />
              <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 4 }}>
                Only lowercase letters, numbers, and underscores.
              </Text>
            </View>

            <View>
              <Text style={[styles.label, { color: theme.text }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.tint, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSaveProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Profile</Text>
              )}
            </TouchableOpacity>

             <TouchableOpacity
              style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border, marginTop: 10 }]}
              onPress={signOut}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
