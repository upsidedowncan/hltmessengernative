import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { FeatureFlagProvider, useAppTheme } from '../src/context/FeatureFlagContext';
import { CallProvider } from '../src/context/CallContext';
import { ToastProvider } from '../src/context/ToastContext';
import { useDeepLinkHandler } from '../src/hooks/useDeepLinkHandler';

function AuthProtection() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useAppTheme();
  useDeepLinkHandler();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    if (!session) {
      if (!inAuthGroup) {
        // Redirect to login if not authenticated and not already in auth group
        router.replace('/(auth)/login');
      }
    } else {
        // User is logged in
        if (profile && !profile.username) {
            // If profile setup is needed
             // Check if we are already there to avoid loop? 
             // segments[0] might be 'profile-setup'
             const inProfileSetup = segments[0] === 'profile-setup';
             if (!inProfileSetup) {
                 router.replace('/profile-setup');
             }
        } else if (inAuthGroup) {
            // Redirect away from auth screens if logged in
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
    const { isDarkMode } = useAppTheme();
    return (
        <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
            <AuthProtection />
        </ThemeProvider>
    );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FeatureFlagProvider>
             <ToastProvider>
                <CallProvider>
                  <SafeAreaProvider>
                    <ThemeWrapper />
                  </SafeAreaProvider>
                </CallProvider>
             </ToastProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
