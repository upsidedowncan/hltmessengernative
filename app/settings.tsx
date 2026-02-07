import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, Switch as RNSwitch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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
import { useSendNotification } from '@/hooks/use-send-notification';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/services/supabase';
import { t } from '@/services/i18n';

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { signOut, profile, refreshProfile, user } = useAuth();
  const router = useRouter();
  const { sendNotification } = useSendNotification();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstLoad = useRef(true);

  const sendTestNotification = async () => {
    if (!user) {
      Alert.alert(t('settings.testNotificationAuthErrorTitle'), t('settings.testNotificationAuthErrorMessage'));
      return;
    }

    setTestNotificationLoading(true);
    try {
      await sendNotification({
        userId: user.id,
        title: t('settings.testNotificationTitle'),
        body: t('settings.testNotificationBody'),
        screen: 'chats',
        params: {},
      });
      
      // Also show a local notification since push won't appear in foreground
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('settings.testNotificationLocalTitle'),
          body: t('settings.testNotificationLocalBody'),
          data: { screen: 'chats' },
        },
        trigger: null, // Show immediately
      });
      
      Alert.alert(t('settings.testNotificationSuccessTitle'), t('settings.testNotificationSuccessMessage'));
    } catch (error) {
      console.error('Test notification failed:', error);
      Alert.alert(t('settings.testNotificationErrorTitle'), t('settings.testNotificationErrorMessage'));
    } finally {
      setTestNotificationLoading(false);
    }
  };

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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic">
      <AppBar title={t('settings.title')} isNative={true} largeTitle={true} />

      <ProfileHeader 
        fullName={fullName}
        username={username}
        isSaving={isSaving}
        onFullNameChange={onFullNameChange}
        onUsernameChange={onUsernameChange}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.general')}</Text>
        <View style={styles.groupContainer}>
          <Tile
            title={t('settings.notifications')}
            icon="notifications-outline"
            onPress={() => {}}
            groupPosition="top"
          />
          <Tile
            title={t('settings.darkMode')}
            icon="moon-outline"
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            groupPosition="middle"
            rightElement={
              <RNSwitch
                value={themeMode === 'dark'}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                trackColor={{ false: '#767577', true: theme.tint }}
                thumbColor="#fff"
              />
            }
          />
          <Tile
            title={t('settings.useSystemTheme')}
            icon="phone-portrait-outline"
            onPress={() => setThemeMode(themeMode === 'system' ? 'light' : 'system')}
            groupPosition="bottom"
            rightElement={
              <RNSwitch
                value={themeMode === 'system'}
                onValueChange={(val) => setThemeMode(val ? 'system' : 'light')}
                trackColor={{ false: '#767577', true: theme.tint }}
                thumbColor="#fff"
              />
            }
            chevron={false}
          />
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <NotificationSetup />
          
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: theme.tint }]}
            onPress={sendTestNotification}
            disabled={testNotificationLoading}
          >
            {testNotificationLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.testButtonText}>{t('settings.testNotification')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.security')}</Text>
        <View style={styles.groupContainer}>
          <Tile
            title={t('settings.locationSecurity')}
            icon="location-outline"
            onPress={() => router.push('/security-settings')}
            groupPosition="top"
          />
          <Tile
            title={t('settings.trustedDevices')}
            icon="phone-portrait-outline"
            onPress={() => {}}
            groupPosition="bottom"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.developer')}</Text>
        <View style={styles.groupContainer}>
          <Tile
            title={t('settings.componentLab')}
            icon="beaker-outline"
            onPress={() => router.push('/component-test')}
            groupPosition="top"
          />
          <Tile
            title={t('settings.developerSettings')}
            icon="code-slash-outline"
            onPress={() => router.push('/dev-settings')}
            groupPosition="bottom"
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={{ paddingHorizontal: 24 }}>
          <Button
            title={t('settings.signOut')}
            onPress={signOut}
            type="outline"
            color="#ef5350"
            textColor="#ef5350"
            icon="log-out-outline"
          />
        </View>
      </View>
    </ScrollView>
  );
}

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
  testButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
