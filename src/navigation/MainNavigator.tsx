import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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

// Use the Standard JS Bottom Tab Navigator
const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainTabs = () => {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.cardBackground,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={{ 
          tabBarLabel: 'Chats',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen} 
        options={{ 
          tabBarLabel: 'People',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="AI" 
        component={AIChatListScreen} 
        options={{ 
          tabBarLabel: 'AI',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} />
          ),
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