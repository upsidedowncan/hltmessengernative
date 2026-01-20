import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/services/supabase';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '../../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, TextInput as PaperInput, Surface, Avatar } from 'react-native-paper';
import { Button } from '@expo/ui/jetpack-compose';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long.');
      return;
    }
    if (!fullName) {
      Alert.alert('Error', 'Display Name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.rpc('upsert_profile', {
        new_username: username,
        new_full_name: fullName,
        new_avatar_url: profile?.avatar_url || null
      });

      if (error) {
        if (error.message.includes('unique constraint')) {
          throw new Error('Username already taken.');
        }
        throw error;
      }

      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    }
    finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (fullName) return fullName.substring(0, 2).toUpperCase();
    if (username) return username.substring(0, 2).toUpperCase();
    return '??';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.background }} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.Content title="Profile" titleStyle={{ color: m3.onSurface }} />
      </Appbar.Header>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Avatar.Text
              size={100}
              label={getInitials()}
              style={[styles.avatar, { backgroundColor: m3.primaryContainer }]}
              labelStyle={{ color: m3.onPrimaryContainer, fontSize: 36 }}
            />
            <Text style={[styles.headerTitle, { color: m3.onSurface }]}>{fullName || 'User Profile'}</Text>
            <Text style={[styles.headerSubtitle, { color: m3.onSurfaceVariant }]}>@{username || 'username'}</Text>
          </View>

          <View style={styles.form}>
            <Surface style={styles.formCard} elevation={0}>
              <PaperInput
                label="Display Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your Name"
                mode="outlined"
                outlineStyle={{ borderColor: m3.outline }}
                activeOutlineColor={m3.primary}
                textColor={m3.onSurface}
                placeholderTextColor={m3.onSurfaceVariant}
                style={styles.input}
                theme={{
                  colors: {
                    background: m3.surface,
                    text: m3.onSurface,
                    placeholder: m3.onSurfaceVariant,
                    primary: m3.primary,
                  }
                }}
              />
              <PaperInput
                label="Username"
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                autoCapitalize="none"
                mode="outlined"
                outlineStyle={{ borderColor: m3.outline }}
                activeOutlineColor={m3.primary}
                textColor={m3.onSurface}
                placeholderTextColor={m3.onSurfaceVariant}
                style={styles.input}
                theme={{
                  colors: {
                    background: m3.surface,
                    text: m3.onSurface,
                    placeholder: m3.onSurfaceVariant,
                    primary: m3.primary,
                  }
                }}
              />
            </Surface>

            <Text style={{ color: m3.onSurfaceVariant, fontSize: 12, marginTop: 8, marginBottom: 16, marginLeft: 4 }}>
              Unique identifier for friends to find you.
            </Text>

            <Button
              variant="default"
              onPress={handleUpdateProfile}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Profile'}
            </Button>

            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Surface style={styles.tile} elevation={0}>
                <View style={styles.tileContent}>
                  <Avatar.Icon size={24} icon="cog" style={{ backgroundColor: 'transparent' }} color={m3.onSurface} />
                  <Text style={[styles.tileText, { color: m3.onSurface }]}>Settings</Text>
                </View>
              </Surface>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
  form: {
    gap: 16,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    borderRadius: 20,
  },
  tile: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  tileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileText: {
    fontSize: 16,
    marginLeft: 12,
  },
});
