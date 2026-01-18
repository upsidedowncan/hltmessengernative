import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/context/FeatureFlagContext';

export default function TabLayout() {
  const { theme } = useAppTheme();

  return (
    <NativeTabs
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