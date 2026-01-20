import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { FeatureFlagProvider, useFeatureFlags } from '../src/context/FeatureFlagContext';
import { ThemeProvider as CustomThemeProvider, useTheme } from '../src/context/ThemeContext';
import { CallProvider } from '../src/context/CallContext';
import { ToastProvider } from '../src/context/ToastContext';
import { useDeepLinkHandler } from '../src/hooks/useDeepLinkHandler';
import { HostWrapper } from '../src/components/ui/HostWrapper';

function AuthProtection() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useTheme();
  useDeepLinkHandler();

  useEffect(() => {
    if (loading) return;

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
  }, [session, loading, segments, profile]);

  if (loading) {
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
  
  const theme = { ...baseTheme };
  const accentOverride = getValue('ACCENT_COLOR');
  if (accentOverride) {
    theme.tint = accentOverride;
  }

  return (
      <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
            {Platform.OS === 'android' ? (
              <PaperProvider>
                <AuthProtection />
              </PaperProvider>
            ) : (
              <AuthProtection />
            )}
        </ThemeProvider>
    );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <CustomThemeProvider>
            <FeatureFlagProvider>
                 <ToastProvider>
                    <CallProvider>
                      <SafeAreaProvider>
                        <ThemeWrapper />
                      </SafeAreaProvider>
                    </CallProvider>
                 </ToastProvider>
            </FeatureFlagProvider>
          </CustomThemeProvider>
        </AuthProvider>
    </GestureHandlerRootView>
  );
}
