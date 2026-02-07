import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useCustomBackground } from '@/contexts/custom-background-context';
import { useTheme } from '@/contexts/theme-context';
import Animated from 'react-native-reanimated';

export function CustomBackground() {
  const { backgroundUri } = useCustomBackground();
  const { isDarkMode } = useTheme();

  if (!backgroundUri) {
    return null;
  }

  return (
    <Animated.View style={StyleSheet.absoluteFillObject}>
      <Image
        source={{ uri: backgroundUri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.overlay} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});
