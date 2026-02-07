import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { useCall } from '@/contexts/call-context';
import { callService } from '@/services/call-service';
import { useFeatureFlags } from '@/contexts/feature-flag-context';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';

export default function ChatInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendId = params.friendId as string;
  const friendName = params.friendName as string;
  const friendAvatar = params.friendAvatar as string | undefined;

  const { theme } = useTheme();
  const { setIsCallInProgress } = useCall() as any;
  const { isEnabled } = useFeatureFlags();
  const insets = useSafeAreaInsets();

  const [isChatLocked, setIsChatLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

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

  const renderProfileSection = () => (
    <View style={[styles.profileSection, { backgroundColor: theme.background }]}>
      <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
        <Text style={styles.avatarText}>{friendName?.charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <Text style={[styles.name, { color: theme.text }]}>{friendName}</Text>
    </View>
  );

  const renderCallsSection = () => (
    <View style={[styles.section, { backgroundColor: theme.background }]}>
      <Text style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>Calls</Text>
      
      {isLiquidGlassSupported ? (
        <LiquidGlassView style={[styles.row, { borderBottomColor: theme.border }]} interactive>
          <TouchableOpacity style={styles.rowTouchable} onPress={handleVoiceCall}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#34C759' }]}>
                <Ionicons name="call-outline" size={22} color="#fff" />
              </View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Voice Call</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.tabIconDefault} />
          </TouchableOpacity>
        </LiquidGlassView>
      ) : (
        <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={handleVoiceCall}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: '#34C759' }]}>
              <Ionicons name="call-outline" size={22} color="#fff" />
            </View>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Voice Call</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.tabIconDefault} />
        </TouchableOpacity>
      )}

      {isLiquidGlassSupported ? (
        <LiquidGlassView style={styles.row} interactive>
          <TouchableOpacity style={styles.rowTouchable} onPress={handleVideoCall}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#007AFF' }]}>
                <Ionicons name="videocam-outline" size={22} color="#fff" />
              </View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Video Call</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.tabIconDefault} />
          </TouchableOpacity>
        </LiquidGlassView>
      ) : (
        <TouchableOpacity style={styles.row} onPress={handleVideoCall}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: '#007AFF' }]}>
              <Ionicons name="videocam-outline" size={22} color="#fff" />
            </View>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Video Call</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.tabIconDefault} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSecuritySection = () => (
    <View style={[styles.section, { backgroundColor: theme.background }]}>
      <Text style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>Security</Text>
      
      {isLiquidGlassSupported ? (
        <LiquidGlassView style={styles.row} interactive>
          <TouchableOpacity style={styles.rowTouchable} onPress={handleLockChat}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: isChatLocked ? '#FF9500' : '#8E8E93' }]}>
                <Ionicons name={isChatLocked ? 'lock-closed' : 'lock-open'} size={22} color="#fff" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Lock Chat</Text>
                <Text style={[styles.rowSubtitle, { color: theme.tabIconDefault }]}>
                  {isChatLocked ? 'Chat is locked' : 'Chat is unlocked'}
                </Text>
              </View>
            </View>
            {biometricAvailable && (
              <Ionicons 
                name={isChatLocked ? 'checkmark-circle' : 'ellipse-outline'} 
                size={24} 
                color={isChatLocked ? '#34C759' : theme.tabIconDefault} 
              />
            )}
          </TouchableOpacity>
        </LiquidGlassView>
      ) : (
        <TouchableOpacity style={styles.row} onPress={handleLockChat}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: isChatLocked ? '#FF9500' : '#8E8E93' }]}>
              <Ionicons name={isChatLocked ? 'lock-closed' : 'lock-open'} size={22} color="#fff" />
            </View>
            <View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Lock Chat</Text>
              <Text style={[styles.rowSubtitle, { color: theme.tabIconDefault }]}>
                {isChatLocked ? 'Chat is locked' : 'Chat is unlocked'}
              </Text>
            </View>
          </View>
          {biometricAvailable && (
            <Ionicons 
              name={isChatLocked ? 'checkmark-circle' : 'ellipse-outline'} 
              size={24} 
              color={isChatLocked ? '#34C759' : theme.tabIconDefault} 
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Chat Info</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {renderProfileSection()}
        {renderCallsSection()}
        {renderSecuritySection()}

        {!biometricAvailable && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={20} color={theme.tabIconDefault} />
            <Text style={[styles.warningText, { color: theme.tabIconDefault }]}>
              Biometric authentication is not available on this device.
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    marginRight: 40,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
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
