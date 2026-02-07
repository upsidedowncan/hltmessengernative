import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Appbar, IconButton, Text as RNPText, Divider, Surface, Avatar, Icon } from 'react-native-paper';
import { TouchableRipple } from '@/components/touchable-ripple';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '@/contexts/theme-context';
import { useCall } from '@/contexts/call-context';
import { callService } from '@/services/call-service';
import { useFeatureFlags } from '@/contexts/feature-flag-context';

export default function ChatInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendId = params.friendId as string;
  const friendName = params.friendName as string;
  const friendAvatar = params.friendAvatar as string | undefined;

  const { isDarkMode } = useTheme();
  const { setIsCallInProgress } = useCall() as any;
  const { isEnabled } = useFeatureFlags();
  const insets = useSafeAreaInsets();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const [isChatLocked, setIsChatLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Generate a consistent random color based on friendId
  const avatarColor = useMemo(() => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8B500', '#6C5CE7', '#A29BFE', '#74B9FF', '#00B894',
      '#E17055', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00CEC9'
    ];
    // Use friendId to pick a consistent color for the same user
    let hash = 0;
    for (let i = 0; i < friendId.length; i++) {
      hash = friendId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }, [friendId]);

  // Calculate contrasting text color (black or white)
  const avatarTextColor = useMemo(() => {
    const hex = avatarColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }, [avatarColor]);

  useEffect(() => {
    const checkBiometric = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setBiometricAvailable(compatible);
    };
    checkBiometric();

    const checkLockStatus = async () => {
      const locked = await AsyncStorage.getItem(`locked_chat_${friendId}`);
      setIsChatLocked(locked === 'true');
    };
    checkLockStatus();
  }, [friendId]);

  const handleLockChat = async () => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to lock/unlock this chat',
    });

    if (result.success) {
      const newValue = !isChatLocked;
      setIsChatLocked(newValue);
      await AsyncStorage.setItem(`locked_chat_${friendId}`, newValue.toString());
    }
  };

  const handleVoiceCall = () => {
    if (!isEnabled('ENABLE_CALLING') || !callService.isSupported()) {
      Alert.alert('Unavailable', 'Voice calls are not available.');
      return;
    }
    setIsCallInProgress(true);
    router.push({
      pathname: '/call/[id]',
      params: { id: friendId, friendId, friendName, friendAvatar: friendAvatar || '', isIncoming: 'false', isVideo: 'false' }
    });
  };

  const handleVideoCall = () => {
    if (!isEnabled('ENABLE_CALLING') || !callService.isSupported()) {
      Alert.alert('Unavailable', 'Video calls are not available.');
      return;
    }
    setIsCallInProgress(true);
    router.push({
      pathname: '/call/[id]',
      params: { id: friendId, friendId, friendName, friendAvatar: friendAvatar || '', isIncoming: 'false', isVideo: 'true' }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Chat Info" titleStyle={{ color: m3.onSurface }} />
      </Appbar.Header>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card - Similar to avatarSection in settings */}
        <Surface 
          style={[styles.profileCard, { backgroundColor: m3.inverseOnSurface }]} 
          elevation={1}
        >
          <Avatar.Text
            size={80}
            label={friendName?.charAt(0).toUpperCase() || '?'}
            style={{ backgroundColor: avatarColor }}
            labelStyle={{ color: avatarTextColor, fontSize: 32, fontWeight: '600' }}
          />
          <View style={styles.profileTextContainer}>
            <RNPText variant="titleLarge" style={{ color: m3.onSurface, fontWeight: '600' }}>
              {friendName}
            </RNPText>
          </View>
        </Surface>

        {/* Calls Section */}
        <RNPText variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>
          CALLS
        </RNPText>
        <Surface 
          style={[styles.sectionCard, { backgroundColor: m3.inverseOnSurface }]} 
          elevation={2}
        >
          <TouchableRipple 
            onPress={handleVoiceCall}
            style={[styles.item, { borderTopLeftRadius: 14, borderTopRightRadius: 14 }]}
          >
            <View style={styles.itemContent}>
              <View style={[styles.iconContainer, { backgroundColor: '#34C759' }]}>
                <MaterialCommunityIcons name="phone-outline" size={20} color="#fff" />
              </View>
              <RNPText variant="bodyLarge" style={{ color: m3.onSurface, flex: 1, fontWeight: '500' }}>
                Voice Call
              </RNPText>
              <Icon source="chevron-right" size={20} color={m3.onSurface} />
            </View>
          </TouchableRipple>

          <Divider style={{ marginLeft: 56, backgroundColor: m3.outlineVariant }} />

          <TouchableRipple 
            onPress={handleVideoCall}
            style={[styles.item, { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }]}
          >
            <View style={styles.itemContent}>
              <View style={[styles.iconContainer, { backgroundColor: '#007AFF' }]}>
                <MaterialCommunityIcons name="video-outline" size={20} color="#fff" />
              </View>
              <RNPText variant="bodyLarge" style={{ color: m3.onSurface, flex: 1, fontWeight: '500' }}>
                Video Call
              </RNPText>
              <Icon source="chevron-right" size={20} color={m3.onSurface} />
            </View>
          </TouchableRipple>
        </Surface>

        {/* Security Section */}
        <RNPText variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>
          SECURITY
        </RNPText>
        <Surface 
          style={[styles.sectionCard, { backgroundColor: m3.inverseOnSurface }]} 
          elevation={2}
        >
          <TouchableRipple 
            onPress={handleLockChat}
            style={[styles.item, { borderRadius: 14 }]}
          >
            <View style={styles.itemContent}>
              <View style={[styles.iconContainer, { backgroundColor: isChatLocked ? m3.primary : m3.outline }]}>
                <MaterialCommunityIcons 
                  name={isChatLocked ? 'lock' : 'lock-open-variant'} 
                  size={20} 
                  color={m3.onSurface} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <RNPText variant="bodyLarge" style={{ color: m3.onSurface, fontWeight: '500' }}>
                  Lock Chat
                </RNPText>
                <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant }}>
                  {isChatLocked ? 'Chat is locked' : 'Chat is unlocked'}
                </RNPText>
              </View>
              {biometricAvailable && (
                <IconButton 
                  icon={isChatLocked ? 'check-circle' : 'circle-outline'}
                  size={24} 
                  iconColor={isChatLocked ? m3.primary : m3.onSurfaceVariant}
                />
              )}
            </View>
          </TouchableRipple>
        </Surface>

        {!biometricAvailable && (
          <View style={styles.warningContainer}>
            <IconButton icon="alert" size={20} iconColor={m3.onSurfaceVariant} />
            <RNPText variant="bodyMedium" style={[styles.warningText, { color: m3.onSurfaceVariant }]}>
              Biometric authentication is not available on this device.
            </RNPText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  profileTextContainer: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
  },
});
