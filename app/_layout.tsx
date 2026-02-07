import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { SecurityProvider, useSecurity } from '@/contexts/security-context';
import { FeatureFlagProvider, useFeatureFlags } from '@/contexts/feature-flag-context';
import { ThemeProvider as CustomThemeProvider, useTheme } from '@/contexts/theme-context';
import { CustomBackgroundProvider } from '@/contexts/custom-background-context';
import { CallProvider } from '@/contexts/call-context';
import { ToastProvider } from '@/contexts/toast-context';
import { IncomingCallModal } from '@/components/incoming-call-modal';
import { addCallListener } from '@/hooks/use-native-push';
import { useCall } from '@/contexts/call-context';
import { useDeepLinkHandler } from '@/hooks/use-deep-link-handler';
import { HostWrapper } from '@/components/ui/host-wrapper';
import SecurityBlockOverlay from './security-block-overlay';

function AuthProtection() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useTheme();
  const { isBlocked } = useSecurity();
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricCheckDone, setBiometricCheckDone] = useState(false);
  const [isReady, setIsReady] = useState(false);
  useDeepLinkHandler();

  // Reset state when session changes
  useEffect(() => {
    if (!session) {
      setBiometricCheckDone(true);
      setBiometricLocked(false);
      setIsReady(true);
    }
  }, [session]);

  const checkBiometric = useCallback(async () => {
    if (!session || loading || isBlocked) {
      setBiometricCheckDone(true);
      setIsReady(true);
      return;
    }

    try {
      const biometricEnabled = await AsyncStorage.getItem('biometric_enabled');
      if (biometricEnabled === 'true') {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        if (compatible) {
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (enrolled) {
            setBiometricLocked(true);
          }
        }
      }
    } catch (e) {
      console.log('Biometric check error:', e);
    }
    setBiometricCheckDone(true);
  }, [session, loading, isBlocked]);

  useEffect(() => {
    if (!loading && session && !biometricCheckDone) {
      checkBiometric();
    } else if (!loading && !session) {
      setIsReady(true);
    }
  }, [loading, session, biometricCheckDone, checkBiometric]);

  const authenticateBiometric = async () => {
    if (!biometricLocked) return true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access app',
      });
      if (result.success) {
        setBiometricLocked(false);
        setIsReady(true);
        return true;
      }
    } catch (e) {
      console.log('Biometric auth error:', e);
    }
    return false;
  };

  useEffect(() => {
    if (biometricLocked && biometricCheckDone && !isBlocked && !isReady) {
      authenticateBiometric();
    } else if (biometricCheckDone && !biometricLocked) {
      setIsReady(true);
    }
  }, [biometricLocked, biometricCheckDone, isBlocked, isReady]);

  // Handle navigation only when ready
  useEffect(() => {
    if (loading || !isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (profile && !profile.username) {
        const inProfileSetup = segments[0] === 'profile-setup';
        if (!inProfileSetup) {
          router.replace('/profile-setup');
        }
      } else if (inAuthGroup) {
        router.replace('/(tabs)/chats');
      }
    }
  }, [session, loading, segments, profile, isReady]);

  // Show loading spinner while checking biometric or loading
  if (loading || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return <Slot />;
}

function ThemeWrapper() {
  const { isDarkMode, theme: baseTheme } = useTheme();
  const { getValue } = useFeatureFlags();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const theme = { ...baseTheme };
  const accentOverride = getValue('ACCENT_COLOR');
  if (accentOverride) {
    theme.tint = accentOverride;
  }

  // Use native m3 colors from expo-material3-theme
  const paperTheme = {
    dark: isDarkMode,
    colors: {
      primary: accentOverride || m3.primary,
      onPrimary: m3.onPrimary,
      primaryContainer: m3.primaryContainer,
      onPrimaryContainer: m3.onPrimaryContainer,
      secondary: m3.secondary,
      onSecondary: m3.onSecondary,
      secondaryContainer: m3.secondaryContainer,
      onSecondaryContainer: m3.onSecondaryContainer,
      tertiary: m3.tertiary,
      onTertiary: m3.onTertiary,
      tertiaryContainer: m3.tertiaryContainer,
      onTertiaryContainer: m3.onTertiaryContainer,
      error: m3.error,
      onError: m3.onError,
      errorContainer: m3.errorContainer,
      onErrorContainer: m3.onErrorContainer,
      background: m3.background,
      onBackground: m3.onBackground,
      surface: m3.surface,
      onSurface: m3.onSurface,
      surfaceVariant: m3.surfaceVariant,
      onSurfaceVariant: m3.onSurfaceVariant,
      outline: m3.outline,
      outlineVariant: m3.outlineVariant,
      scrim: m3.scrim,
      inverseSurface: m3.inverseSurface,
      inverseOnSurface: m3.inverseOnSurface,
      inversePrimary: m3.inversePrimary,
      shadow: m3.shadow,
      surfaceTint: accentOverride || m3.primary,
      elevation: {
        level0: 'transparent',
        level1: m3.surfaceVariant,
        level2: m3.surfaceVariant,
        level3: m3.surfaceVariant,
        level4: m3.surfaceVariant,
        level5: m3.surfaceVariant,
      },
    },
  };

  return (
    <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <PaperProvider theme={paperTheme}>
        <AuthProtection />
        <SecurityBlockOverlay />
      </PaperProvider>
    </ThemeProvider>
  );
}

function CallModal() {
  const router = useRouter();
  const { setIsCallInProgress } = useCall();
  const [pendingCall, setPendingCall] = useState<{
    callerId: string | null;
    callerName: string | null;
    callType: 'audio' | 'video';
  } | null>(null);

  useEffect(() => {
    const unsubscribe = addCallListener((data) => {
      console.log('[CallModal] Received call event:', data);
      setPendingCall({
        callerId: data.callerId,
        callerName: data.callerName,
        callType: data.callType,
      });
    });

    // Also check for last notification
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        const data = response.notification.request.content.data as any;
        if (data?.type === 'call' || data?.type === 'incoming_call') {
          setPendingCall({
            callerId: data?.caller_id || null,
            callerName: data?.caller_name || 'Unknown',
            callType: (data?.call_type as 'audio' | 'video') || 'video',
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const visible = !!pendingCall;

  const handleAccept = () => {
    if (pendingCall?.callerId) {
      setIsCallInProgress(true);
      router.push({
        pathname: '/call/[id]',
        params: {
          id: pendingCall.callerId,
          friendId: pendingCall.callerId,
          friendName: pendingCall.callerName || 'Unknown',
          isIncoming: 'true',
          isVideo: pendingCall.callType === 'video' ? 'true' : 'false',
        }
      });
      setPendingCall(null);
    }
  };

  const handleDecline = () => {
    setPendingCall(null);
  };

  if (!visible) return null;

  return (
    <IncomingCallModal
      visible={visible}
      callerName={pendingCall?.callerName || 'Unknown'}
      callType={pendingCall?.callType || 'video'}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SecurityProvider>
          <CustomThemeProvider>
            <CustomBackgroundProvider>
              <FeatureFlagProvider>
                <ToastProvider>
                  <CallProvider>
                    <SafeAreaProvider>
                      <ThemeWrapper />
                      <CallModal />
                    </SafeAreaProvider>
                  </CallProvider>
                </ToastProvider>
              </FeatureFlagProvider>
            </CustomBackgroundProvider>
          </CustomThemeProvider>
        </SecurityProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
