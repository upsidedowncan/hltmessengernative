import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { SingleChatScreen } from '../screens/SingleChatScreen';
import { CallScreen } from '../screens/CallScreen';
import { DevSettingsScreen } from '../screens/DevSettingsScreen';
import { useAppTheme } from '../context/FeatureFlagContext';

import { ComponentTestScreen } from '../screens/ComponentTestScreen';

export type MainStackParamList = {
  MainTabs: undefined;
  SingleChat: {
    friendId: string;
    friendName: string;
    friendAvatar?: string;
  };
  Call: {
    friendId: string;
    friendName: string;
    isIncoming: boolean;
    isVideo?: boolean;
  };
  DevSettings: undefined;
  ComponentTest: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainNavigator = () => {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        headerBackTitle: "",
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={TabNavigator} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="SingleChat" 
        component={SingleChatScreen}
        options={({ route }) => ({ title: route.params.friendName })}
      />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="DevSettings"
        component={DevSettingsScreen}
        options={{ title: 'Developer Settings' }}
      />
      <Stack.Screen
        name="ComponentTest"
        component={ComponentTestScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
