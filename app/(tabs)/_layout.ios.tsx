import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      iconColor={{
        default: theme.tabIconDefault,
        selected: theme.tint,
      }}
      tintColor={theme.tint}
      labelStyle={{
        color: theme.text,
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
