import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Host } from '@expo/ui/swift-ui';
import { useTheme } from '../../src/context/ThemeContext';

export default function CreateScreenIOS() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: theme.text }]}>New Chat</Text>
      <Text style={[styles.subtitle, { color: theme.tabIconDefault }]}>Who do you want to talk to?</Text>

      <View style={styles.content}>
        <View style={styles.section}>
          <Host style={styles.host}>
            <Button 
              onPress={() => router.push('/(tabs)/ai')}
              variant="glassProminent" // Trying 'filled' for standard iOS look, or default
              style={{ width: '100%' }}
            >
              AI Chat
            </Button>
          </Host>
          <Text style={[styles.description, { color: theme.tabIconDefault }]}>
            Chat with an intelligent assistant
          </Text>
        </View>

        <View style={styles.section}>
          <Host style={styles.host}>
            <Button 
              onPress={() => router.push('/(tabs)/friends')}
              variant="glassProminent"
              style={{ width: '100%' }}
            >
              Normal Chat
            </Button>
          </Host>
          <Text style={[styles.description, { color: theme.tabIconDefault }]}>
            Message your friends
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: 40,
  },
  content: {
    gap: 30,
  },
  section: {
    gap: 10,
  },
  host: {
    height: 50, // Ensure Host has height for the button
    width: '100%',
  },
  description: {
    fontSize: 13,
    paddingLeft: 4,
  },
});
