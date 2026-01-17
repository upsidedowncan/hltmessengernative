import React from 'react';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { ChatScreen } from '../screens/ChatScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppTheme } from '../context/FeatureFlagContext';

const Tab = createNativeBottomTabNavigator();

export const TabNavigator = () => {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      // ✅ FIX: Color props must be inside screenOptions
      screenOptions={{
        tabBarActiveTintColor: theme.tint
      }}
    >
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ 
          title: 'Messages',
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? 'bubble.left.and.bubble.right.fill' : 'bubble.left.and.bubble.right',
          }),
        }} 
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen} 
        options={{
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? 'person.2.fill' : 'person.2',
          }),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? 'gear' : 'gear',
          }),
        }}
      />
    </Tab.Navigator>
  );
};