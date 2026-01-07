import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChatScreen } from '../screens/ChatScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MaterialTabBar } from '../components/MaterialTabBar';
import { useAppTheme } from '../context/FeatureFlagContext';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      tabBar={(props) => <MaterialTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { 
          backgroundColor: theme.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: { 
          color: theme.text,
          fontWeight: '700',
          fontSize: 22,
        },
        headerTitleAlign: 'left', // Material 3 style
      }}
    >
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};