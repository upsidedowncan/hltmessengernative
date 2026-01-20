import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface, useTheme as usePaperTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateScreen() {
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

      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/ai')}
          activeOpacity={0.8}
        >
          <Surface style={[styles.optionCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <Ionicons name="sparkles" size={32} color={theme.colors.onPrimaryContainer} />
            </View>
            <View style={styles.textContainer}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>AI Chat</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Chat with an intelligent assistant</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurfaceVariant} />
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/friends')}
          activeOpacity={0.8}
        >
          <Surface style={[styles.optionCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Ionicons name="people" size={32} color={theme.colors.onSecondaryContainer} />
            </View>
            <View style={styles.textContainer}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>Normal Chat</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Message your friends</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurfaceVariant} />
          </Surface>
        </TouchableOpacity>
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
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
});
