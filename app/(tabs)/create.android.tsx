import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme as usePaperTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@expo/ui/jetpack-compose';

export default function CreateScreenAndroid() {
  const router = useRouter();
  const theme = usePaperTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
        New Chat
      </Text>
      <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Who do you want to talk to?
      </Text>

      <View style={styles.buttonContainer}>
        <Button 
          variant="filled" // Assuming 'filled' or 'default' is available; 'default' was used in test
          onPress={() => router.push('/(tabs)/ai')}
          style={styles.button}
        >
          AI Chat
        </Button>
        
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Chat with an intelligent assistant
        </Text>

        <View style={styles.spacer} />

        <Button 
          variant="filled"
          onPress={() => router.push('/(tabs)/friends')}
          style={styles.button}
        >
          Normal Chat
        </Button>

        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Message your friends
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 48,
  },
  buttonContainer: {
    alignItems: 'stretch',
  },
  button: {
    height: 56, // Make them a bit taller if possible
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 24,
    marginLeft: 4,
  },
  spacer: {
    height: 16,
  }
});
