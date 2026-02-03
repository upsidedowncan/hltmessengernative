import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, FlatList, Animated, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useThemeMode, useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/services/supabase';
import {
  Appbar,
  Text as RNPText,
  Divider,
  TouchableRipple,
  Avatar,
  Icon,
  Surface,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SettingsItem {
  id: string;
  title: string;
  icon: string;
  onPress?: () => void;
  rightElement?: 'switch' | 'chevron' | 'text';
  rightText?: string;
  switchValue?: boolean;
  danger?: boolean;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const AnimatedIcon = ({
  isChecked,
  colorChecked,
  colorUnchecked,
  style
}: {
  isChecked: boolean;
  colorChecked: string;
  colorUnchecked: string;
  style?: any;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isChecked ? 1 : 0.8,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(opacityAnim, {
        toValue: isChecked ? 1 : 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isChecked]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }, style]}>
      <Icon
        source={isChecked ? 'check' : 'close'}
        size={18}
        color={isChecked ? colorChecked : colorUnchecked}
      />
    </Animated.View>
  );
};

export default function SettingsScreen() {
  const { isDarkMode } = useTheme();
  const { mode, setMode } = useThemeMode();
  const { signOut, profile, refreshProfile, user } = useAuth();
  const router = useRouter();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstLoad = useRef(true);

  const [locationTracking, setLocationTracking] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(mode === 'dark');
  const [systemTheme, setSystemTheme] = useState(mode === 'system');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    setDarkMode(mode === 'dark');
    setSystemTheme(mode === 'system');
  }, [mode]);

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
          new_avatar_url: profile?.avatar_url || null,
        });

        if (!error) {
          await refreshProfile();
        }
      } catch (e) {
        console.log('Auto-save failed', e);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  };


  const sections: SettingsSection[] = [
    {
      title: 'Profile',
      items: [
        {
          id: 'fullname',
          title: 'Display Name',
          icon: 'account',
          rightElement: 'text',
          rightText: isSaving ? 'Saving...' : '',
        },
        {
          id: 'username',
          title: 'Username',
          icon: 'at',
          rightElement: 'text',
          rightText: isSaving ? 'Saving...' : '',
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          id: 'biometric',
          title: 'Fingerprint / Face',
          icon: 'fingerprint',
          onPress: toggleBiometric,
          rightElement: 'switch',
          switchValue: biometricEnabled && biometricAvailable,
        },
        {
          id: 'location',
          title: 'Location Security',
          icon: 'map-marker-radius-outline',
          onPress: () => { },
          rightElement: 'chevron',
        },
        {
          id: 'trusted',
          title: 'Trusted Devices',
          icon: 'cellphone-link',
          onPress: () => { },
          rightElement: 'chevron',
        },
        {
          id: 'location-tracking',
          title: 'Track Login Locations',
          icon: 'map-outline',
          rightElement: 'switch',
          switchValue: locationTracking,
        },
        {
          id: 'notifications',
          title: 'Security Notifications',
          icon: 'bell-outline',
          rightElement: 'switch',
          switchValue: notifications,
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          id: 'darkmode',
          title: 'Dark Mode',
          icon: 'weather-night',
          rightElement: 'switch',
          switchValue: darkMode,
        },
        {
          id: 'system-theme',
          title: 'Use System Theme',
          icon: 'cellphone',
          rightElement: 'switch',
          switchValue: systemTheme,
        },
      ],
    },
    {
      title: 'Developer',
      items: [
        {
          id: 'components',
          title: 'Component Lab',
          icon: 'flask-outline',
          onPress: () => router.push('/component-test'),
          rightElement: 'chevron',
        },
        {
          id: 'dev-settings',
          title: 'Developer Settings',
          icon: 'code-tags',
          onPress: () => router.push('/dev-settings'),
          rightElement: 'chevron',
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          id: 'signout',
          title: 'Sign Out',
          icon: 'logout',
          onPress: signOut,
          rightElement: 'text',
          rightText: '',
          danger: true,
        },
      ],
    },
  ];

  const renderSection = ({ item: section }: { item: SettingsSection }) => (
      <View style={styles.section}>
        <RNPText variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>
          {section.title.toUpperCase()}
        </RNPText>
        <Surface style={[styles.sectionContent, { backgroundColor: m3.surfaceContainerHighest }]} elevation={1}>
          {section.items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Divider style={{ marginLeft: 56, backgroundColor: m3.outlineVariant }} />}
              <TouchableRipple
                onPress={() => {
                  if (item.rightElement === 'switch' && item.switchValue !== undefined) {
                    const newValue = !item.switchValue;
                    if (item.id === 'darkmode') {
                      setMode(newValue ? 'dark' : 'light');
                    } else if (item.id === 'system-theme') {
                      setMode(newValue ? 'system' : 'light');
                    } else if (item.id === 'location-tracking') {
                      setLocationTracking(newValue);
                    } else if (item.id === 'notifications') {
                      setNotifications(newValue);
                    } else if (item.id === 'biometric') {
                      toggleBiometric();
                    }
                  } else if (item.onPress) {
                    item.onPress();
                  }
                }}
                style={[
                  styles.item,
                  index === 0 ? { borderTopLeftRadius: 14, borderTopRightRadius: 14 } : {},
                  index === section.items.length - 1 ? { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 } : {},
                ]}
                android_ripple={{ color: m3.onSurface + '20' }}>
                <View style={styles.itemContent}>
                  <View style={[
                    styles.iconContainer,
                    { backgroundColor: item.danger ? m3.errorContainer : m3.surfaceVariant }
                  ]}>
                    <Icon
                      source={item.icon}
                      size={16}
                      color={item.danger ? m3.onErrorContainer : m3.onSurfaceVariant}
                    />
                  </View>

                  <RNPText variant="bodyMedium" style={{ color: item.danger ? m3.onErrorContainer : m3.onSurface, flex: 1, fontWeight: '500' }}>
                    {item.title}
                  </RNPText>

                  {item.rightElement === 'switch' && item.switchValue !== undefined && (
                    <AnimatedIcon
                      isChecked={item.switchValue}
                      colorChecked={m3.primary}
                      colorUnchecked={m3.outline}
                      style={{ marginLeft: 8 }}
                    />
                  )}

                  {item.rightElement === 'text' && (
                    <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginLeft: 8 }}>
                      {item.rightText || ''}
                    </RNPText>
                  )}

                  {item.rightElement === 'chevron' && (
                    <Icon source="chevron-right" size={20} color={m3.onSurfaceVariant} />
                  )}
                </View>
              </TouchableRipple>
            </React.Fragment>
          ))}
        </Surface>
      </View>

  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <View style={{ flex: 1, backgroundColor: m3.background }}>
        <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
          <Appbar.BackAction color={m3.onSurface} onPress={() => router.back()} />
          <Appbar.Content title="Settings" titleStyle={{ color: m3.onSurface }} />
        </Appbar.Header>
        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={(section) => section.title}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Surface style={[styles.avatarSection, { backgroundColor: m3.surfaceContainerHighest }]} elevation={1}>
              <Avatar.Text
                size={80}
                label={fullName.charAt(0).toUpperCase() || 'U'}
                style={{ backgroundColor: m3.primaryContainer }}
                labelStyle={{ color: m3.onPrimaryContainer }}
              />
              <View style={{ marginLeft: 16, flex: 1, justifyContent: 'center' }}>
                <RNPText variant="titleMedium" style={{ color: m3.onSurface, fontWeight: '600' }}>
                  {fullName || 'User'}
                </RNPText>
                <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginTop: 4 }}>
                  @{username}
                </RNPText>
              </View>
            </Surface>
          }
          ListHeaderComponentStyle={styles.avatarHeaderStyle}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  avatarHeaderStyle: {
    marginBottom: 8,
  },
  avatarSection: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  item: {
    minHeight: 48,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  switchContainer: {
    marginLeft: 8,
  },
  textContainer: {
    flex: 1,
  },
});
