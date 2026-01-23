import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabLayout() {
  const isDark = Platform.OS === 'ios' ? false : false;
  
  return (
    <NativeTabs
      backgroundColor={isDark ? '#1c1c1e' : '#fff'}
      iconColor={{
        default: isDark ? '#8e8e93' : '#8e8e93',
        selected: '#007AFF',
      }}
      tintColor="#007AFF"
      labelStyle={{
        color: isDark ? '#fff' : '#000',
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

      <NativeTabs.Trigger name="search" role="search">
        <Label>Search</Label>
        <Icon src={{
            default: <VectorIcon family={Ionicons} name="search" />,
            selected: <VectorIcon family={Ionicons} name="search" />
        }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}