import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';

export default function TabLayout() {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={m3.surface}
      iconColor={{
        default: m3.onSurfaceVariant,
        selected: m3.onSurface,
      }}
      tintColor={m3.primary}
      labelStyle={{
        color: m3.onSurface,
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
