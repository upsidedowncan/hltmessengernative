import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { MainNavigator } from './src/navigation/MainNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { ProfileSetupScreen } from './src/screens/ProfileSetupScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FeatureFlagProvider, useAppTheme } from './src/context/FeatureFlagContext';
import { CallProvider } from './src/context/CallContext';
import { ToastProvider } from './src/context/ToastContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const RootNavigator = () => {
  const { session, loading, profile } = useAuth();
  const { theme } = useAppTheme();
  useDeepLinkHandler(); // Handle incoming notifications/deep links

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (session && session.user) {
    if (profile && !profile.username) {
      return <ProfileSetupScreen />;
    }
    return <MainNavigator />;
  }

  return <AuthNavigator />;
};

import { useDeepLinkHandler } from './src/hooks/useDeepLinkHandler';

const AppContent = () => {
  const { isDarkMode } = useAppTheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <ToastProvider>
          <CallProvider>
            <RootNavigator />
          </CallProvider>
        </ToastProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FeatureFlagProvider>
          <AppContent />
        </FeatureFlagProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
