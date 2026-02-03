import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme, ThemeMode } from '@/contexts/theme-context';
import { Button } from '@/components/button';
import { Tile } from '@/components/tile';
import { ProfileHeader } from '@/components/profile-header';
import { AppBar } from '@/components/app-bar';
import { useAuth } from '@/contexts/auth-context';
import { NotificationSetup } from '@/components/notification-setup';
import { supabase } from '@/services/supabase';
import { Switch, Host, List } from '@expo/ui/swift-ui';

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { signOut, profile, refreshProfile, user } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const checkBiometric = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setBiometricAvailable(compatible);
      if (compatible) {
        const result = await LocalAuthentication.isEnrolledAsync();
        if (result) {
          const saved = await AsyncStorage.getItem('biometric_enabled');
          setBiometricEnabled(saved === 'true');
        }
      }
    };
    checkBiometric();
  }, []);

  const toggleBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to enable biometric login',
    });

    if (result.success) {
      const newValue = !biometricEnabled;
      setBiometricEnabled(newValue);
      await AsyncStorage.setItem('biometric_enabled', newValue.toString());
    }
  };

  useEffect(() => {
    if (profile) {
      if (firstLoad.current) {
        setUsername(profile.username || '');
        setFullName(profile.full_name || '');
        firstLoad.current = false;
      }
    }
  }, [profile]);

  const handleAutoSave = (newUsername: string, newFullName: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!user) return;
    if (newUsername.length < 3) return; 

    setIsSaving(true);
    typingTimeoutRef.current = setTimeout(async () => {
      try {
         const { error } = await supabase.rpc('upsert_profile', {
            new_username: newUsername,
            new_full_name: newFullName,
            new_avatar_url: profile?.avatar_url || null
          });

          if (!error) {
             await refreshProfile();
          }
      } catch (e) {
        console.log("Auto-save failed", e);
      } finally {
        setIsSaving(false);
      }
    }, 1000); 
  };

  const onUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    handleAutoSave(cleaned, fullName);
  };

  const onFullNameChange = (text: string) => {
    setFullName(text);
    handleAutoSave(username, text);
  };

  return (
    <Host style={{ flex: 1 }}>
      <AppBar title="Settings" isNative={true} largeTitle={true} />
      <List
        style={{ flex: 1 }}
        listStyle='insetGrouped'
      >
        <ProfileHeader 
          fullName={fullName}
          username={username}
          isSaving={isSaving}
          onFullNameChange={onFullNameChange}
          onUsernameChange={onUsernameChange}
        />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>General</Text>
          <View style={styles.groupContainer}>
            <Tile
              title="Notifications"
              icon="notifications-outline"
              onPress={() => {}}
              groupPosition="top"
            />
            <Tile
              title="Dark Mode"
              icon="moon-outline"
              onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              groupPosition="middle"
              rightElement={
                <Host>
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                  color={theme.tint}
                  variant="switch"
                />
                </Host>
              }
            />
            <Tile
              title="Use System Theme"
              icon="phone-portrait-outline"
              onPress={() => setThemeMode(themeMode === 'system' ? 'light' : 'system')}
              groupPosition="bottom"
              rightElement={
                <Host>
                <Switch
                  value={themeMode === 'system'}
                  onValueChange={(val) => setThemeMode(val ? 'system' : 'light')}
                  color={theme.tint}
                  variant="switch"
                />
                </Host>
              }
              chevron={false}
            />
          </View>
          <View style={{ paddingHorizontal: 24 }}>
            <NotificationSetup />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>
          <View style={styles.groupContainer}>
            <Tile
              title="Face ID / Touch ID"
              icon="finger-print-outline"
              onPress={toggleBiometric}
              groupPosition="top"
              rightElement={
                <Host>
                  <Switch
                    value={biometricEnabled && biometricAvailable}
                    onValueChange={toggleBiometric}
                    color={theme.tint}
                    variant="switch"
                  />
                </Host>
              }
              chevron={false}
            />
            <Tile
              title="Location Security"
              icon="location-outline"
              onPress={() => {}}
              groupPosition="middle"
            />
            <Tile
              title="Trusted Devices"
              icon="phone-portrait-outline"
              onPress={() => {}}
              groupPosition="bottom"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Developer</Text>
          <View style={styles.groupContainer}>
            <Tile
              title="Component Lab"
              icon="beaker-outline"
              onPress={() => router.push('/component-test')}
              groupPosition="top"
            />
            <Tile
              title="Developer Settings"
              icon="code-slash-outline"
              onPress={() => router.push('/dev-settings')}
              groupPosition="bottom"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ paddingHorizontal: 24 }}>
            <Button
              title="Sign Out"
              onPress={signOut}
              type="outline"
              color="#ef5350"
              textColor="#ef5350"
              icon="log-out-outline"
            />
          </View>
        </View>
      </List>
    </Host>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
  },
  profileHandle: {
    fontSize: 16,
    color: '#888',
  },
  editSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 0, 
  },
  section: {
    marginTop: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  groupContainer: {
    gap: 0,
  },
});