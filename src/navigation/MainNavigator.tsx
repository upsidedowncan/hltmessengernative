import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { MaterialTabBar } from '../components/MaterialTabBar';
import { useAppTheme } from '../context/FeatureFlagContext';

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

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainTabs = () => {
  const { theme } = useAppTheme();
  
  return (
    <Tab.Navigator
      tabBar={(props) => <MaterialTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={{ tabBarLabel: 'Chats' }}
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen} 
        options={{ tabBarLabel: 'People' }}
      />
      <Tab.Screen 
        name="AI" 
        component={AIChatListScreen} 
        options={{ tabBarLabel: 'AI' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export const MainNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
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
