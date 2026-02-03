import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { theme, isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  // Use platform-appropriate colors - Material3 for Android, custom theme for iOS
  const isAndroid = Platform.OS === 'android';
  const backgroundColor = isAndroid ? m3.surface : theme.background;
  const defaultIconColor = isAndroid ? m3.onSurfaceVariant : theme.tabIconDefault;
  const selectedIconColor = isAndroid ? m3.onSurface : theme.tint;
  const labelColor = isAndroid ? m3.onSurface : theme.text;

  return (
    <NativeTabs
      backgroundColor={backgroundColor}
      iconColor={{
        default: defaultIconColor,
        selected: selectedIconColor,
      }}
      tintColor={isAndroid ? m3.primary : theme.tint}
      labelStyle={{
        color: labelColor,
      }}
    >
      <NativeTabs.Trigger name="chats">
        <Label>Chats</Label>
        <Icon src={{
            default: <VectorIcon family={Ionicons} name="chatbubbles-outline" />,
            selected: <VectorIcon family={Ionicons} name="chatbubbles" />
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="friends">
        <Label>People</Label>
        <Icon src={{
            default: <VectorIcon family={Ionicons} name="people-outline" />,
            selected: <VectorIcon family={Ionicons} name="people" />
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ai">
        <Label>AI</Label>
        <Icon src={{
            default: <VectorIcon family={Ionicons} name="sparkles-outline" />,
            selected: <VectorIcon family={Ionicons} name="sparkles" />
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon src={{
            default: <VectorIcon family={Ionicons} name="person-circle-outline" />,
            selected: <VectorIcon family={Ionicons} name="person-circle" />
        }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
