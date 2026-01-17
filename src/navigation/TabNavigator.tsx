import React, { useEffect, useState } from 'react';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { ChatScreen } from '../screens/ChatScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppTheme } from '../context/FeatureFlagContext';

const Tab = createNativeBottomTabNavigator();

export const TabNavigator = () => {
  const { theme } = useAppTheme();
  const [icons, setIcons] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadIcons = async () => {
      try {
        // Ensure the font is loaded before generating images
        if (!Font.isLoaded('Ionicons')) {
          await Font.loadAsync(Ionicons.font);
        }

        const loadedIcons = {
          chat: await Ionicons.getImageSource('chatbubbles', 24, theme.tint),
          chatOutline: await Ionicons.getImageSource('chatbubbles-outline', 24, theme.tabIconDefault),
          people: await Ionicons.getImageSource('people', 24, theme.tint),
          peopleOutline: await Ionicons.getImageSource('people-outline', 24, theme.tabIconDefault),
          settings: await Ionicons.getImageSource('settings', 24, theme.tint),
          settingsOutline: await Ionicons.getImageSource('settings-outline', 24, theme.tabIconDefault),
        };
        setIcons(loadedIcons);
      } catch (e) {
        console.warn('Failed to load tab icons', e);
      } finally {
        setLoaded(true);
      }
    };
    loadIcons();
  }, [theme]);

  if (!loaded) return null;

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
        // @ts-ignore: Native specific prop
        tabBarBackgroundColor: theme.cardBackground,
        tabBarTranslucent: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ 
          title: 'Messages',
          tabBarIcon: ({ focused }) => (focused ? icons.chat : icons.chatOutline),
        }} 
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (focused ? icons.people : icons.peopleOutline),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (focused ? icons.settings : icons.settingsOutline),
        }}
      />
    </Tab.Navigator>
  );
};