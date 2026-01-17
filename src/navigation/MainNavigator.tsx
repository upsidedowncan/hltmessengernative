import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';

// --- Screen Imports ---
import { ChatScreen } from '../screens/ChatScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SingleChatScreen } from '../screens/SingleChatScreen';
import { CallScreen } from '../screens/CallScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DevSettingsScreen } from '../screens/DevSettingsScreen';
import { ComponentTestScreen } from '../screens/ComponentTestScreen';
import { AIChatScreen } from '../screens/AIChatScreen';
import { AIChatListScreen } from '../screens/AIChatListScreen';
import { AISettingsScreen } from '../screens/AISettingsScreen';
import { useAppTheme } from '../context/FeatureFlagContext';

// --- Types ---
export type MainStackParamList = {
  MainTabs: undefined;
  SingleChat: { friendId: string; friendName: string; friendAvatar?: string };
  Call: { friendId: string; friendName: string; friendAvatar?: string; isIncoming: boolean; isVideo: boolean };
  Settings: undefined;
  DevSettings: undefined;
  ComponentTest: undefined;
  AIChat: { conversationId?: string };
  AISettings: undefined;
};

export type MainTabParamList = {
  Chats: undefined;
  Friends: undefined;
  AI: undefined;
  Profile: undefined;
};

// Use the Native Bottom Tab Navigator
const Tab = createNativeBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainTabs = () => {
  const { theme, isDarkMode } = useAppTheme();
  
  // Store generated icons for Android
  const [icons, setIcons] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadIcons = async () => {
      // iOS uses SF Symbols natively; we don't need to generate bitmaps.
      if (Platform.OS === 'ios') {
        setLoaded(true);
        return;
      }

      try {
        // Ensure fonts are loaded before generating images
        if (!Font.isLoaded('Ionicons')) {
          await Font.loadAsync(Ionicons.font);
        }

        // Pre-generate icons with the correct theme colors for Android
        // We generate specific colors to ensure visibility if the native tinting is flaky with URIs
        const [
          chatActive, chatInactive,
          peopleActive, peopleInactive,
          aiActive, aiInactive,
          profileActive, profileInactive
        ] = await Promise.all([
          Ionicons.getImageSource('chatbubbles', 24, theme.tint),
          Ionicons.getImageSource('chatbubbles-outline', 24, theme.tabIconDefault),
          Ionicons.getImageSource('people', 24, theme.tint),
          Ionicons.getImageSource('people-outline', 24, theme.tabIconDefault),
          Ionicons.getImageSource('sparkles', 24, theme.tint),
          Ionicons.getImageSource('sparkles-outline', 24, theme.tabIconDefault),
          Ionicons.getImageSource('person-circle', 24, theme.tint),
          Ionicons.getImageSource('person-circle-outline', 24, theme.tabIconDefault),
        ]);

        setIcons({
          chatActive, chatInactive,
          peopleActive, peopleInactive,
          aiActive, aiInactive,
          profileActive, profileInactive,
        });
      } catch (e) {
        console.warn('Failed to generate native tab icons', e);
      } finally {
        setLoaded(true);
      }
    };

    loadIcons();
  }, [theme]); // Re-run if theme changes

  // Prevent rendering on Android until icons are ready to avoid invisible tabs
  if (!loaded && Platform.OS === 'android') return null;

  return (
    <Tab.Navigator
      // Native Tab Bar Options
      tabBarActiveTintColor={theme.tint}
      tabBarInactiveTintColor={theme.tabIconDefault}
      translucent={true} // iOS effect
      tabBarStyle={{
        backgroundColor: theme.cardBackground,
      }}
      // @ts-ignore: Native specific prop
      activeIndicatorColor={isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={{ 
          tabBarLabel: 'Chats',
          tabBarIcon: ({ focused }) => Platform.select({
            ios: { sfSymbol: focused ? 'bubble.left.and.bubble.right.fill' : 'bubble.left.and.bubble.right' },
            android: focused ? icons.chatActive : icons.chatInactive,
          }),
        }}
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen} 
        options={{ 
          tabBarLabel: 'People',
          tabBarIcon: ({ focused }) => Platform.select({
            ios: { sfSymbol: focused ? 'person.2.fill' : 'person.2' },
            android: focused ? icons.peopleActive : icons.peopleInactive,
          }),
        }}
      />
      <Tab.Screen 
        name="AI" 
        component={AIChatListScreen} 
        options={{ 
          tabBarLabel: 'AI',
          tabBarIcon: ({ focused }) => Platform.select({
            ios: { sfSymbol: focused ? 'sparkles' : 'sparkles' },
            android: focused ? icons.aiActive : icons.aiInactive,
          }),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => Platform.select({
            ios: { sfSymbol: focused ? 'person.circle.fill' : 'person.circle' },
            android: focused ? icons.profileActive : icons.profileInactive,
          }),
        }}
      />
    </Tab.Navigator>
  );
};

export const MainNavigator = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: true,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SingleChat" component={SingleChatScreen} />
      <Stack.Screen name="Call" component={CallScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DevSettings" component={DevSettingsScreen} />
      <Stack.Screen name="ComponentTest" component={ComponentTestScreen} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="AISettings" component={AISettingsScreen} />
    </Stack.Navigator>
  );
};