import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SecurityProvider } from '../src/context/SecurityContext';
import { FeatureFlagProvider, useFeatureFlags } from '../src/context/FeatureFlagContext';
import { ThemeProvider as CustomThemeProvider, useTheme } from '../src/context/ThemeContext';
import { CallProvider } from '../src/context/CallContext';
import { ToastProvider } from '../src/context/ToastContext';
import { useDeepLinkHandler } from '../src/hooks/useDeepLinkHandler';
import { HostWrapper } from '../src/components/ui/HostWrapper';
import SecurityBlockOverlay from './SecurityBlockOverlay';

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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SecurityProvider>
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
        </SecurityProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
