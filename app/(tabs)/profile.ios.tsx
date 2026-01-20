import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/services/supabase';
import { useTheme } from '../../src/context/ThemeContext';
import { TextField } from '../../src/components';
import { Button, Host, List } from '@expo/ui/swift-ui';

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

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
    <Host style={{ flex: 1 }}>
      <List
        style={{ flex: 1 }}
        listStyle='insetGrouped'
      >
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: (theme as any).secondaryContainer || theme.border, borderColor: theme.tint }]}>
            <Text style={[styles.avatarText, { color: (theme as any).onSecondaryContainer || theme.text }]}>{getInitials()}</Text>
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{fullName || 'User Profile'}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>@{username || 'username'}</Text>
        </View>

        <TextField
          label="Display Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your Name"
          leftIcon="person-outline"
        />
        <TextField
          label="Username"
          value={username}
          onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="username"
          autoCapitalize="none"
          leftIcon="at-outline"
        />

        <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginVertical: 8, marginLeft: 16 }}>
          Unique identifier for friends to find you.
        </Text>

        <Button
          onPress={handleUpdateProfile}
          disabled={loading}
          variant="glassProminent"
        >
          Update Profile
        </Button>

        <Button
          onPress={() => router.push('/settings')}
          systemImage="gear"
        >
          Settings
        </Button>
      </List>
    </Host>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
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
});