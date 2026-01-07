import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  Switch as RNSwitch,
  Pressable,
} from 'react-native';
import { useAppTheme } from '../context/FeatureFlagContext';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  useSharedValue, 
  interpolateColor,
} from 'react-native-reanimated';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  forceCustom?: boolean;
}

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const PADDING = 3;
const TRANSLATE_X = TRACK_WIDTH - THUMB_SIZE - (PADDING * 2);

/**
 * Custom Switch component.
 * Uses native iOS Switch.
 * Uses a solid, high-fidelity custom switch for Android with press feedback and overshoot.
 */
export const Switch: React.FC<SwitchProps> = ({ 
  value, 
  onValueChange, 
  disabled = false,
  forceCustom = false,
}) => {
  const { theme, isDarkMode } = useAppTheme();

  const progress = useSharedValue(value ? 1 : 0);
  const isPressed = useSharedValue(false);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 18,
      stiffness: 150,
      mass: 0.8,
    });
  }, [value]);

  const rThumbStyle = useAnimatedStyle(() => {
    const scale = withTiming(isPressed.value ? 1.15 : 1, { duration: 100 });
    
    return {
      transform: [
        { translateX: progress.value * TRANSLATE_X },
        { scale }
      ],
    };
  });

  const rTrackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [isDarkMode ? '#3C4043' : '#BDC1C6', theme.tint]
    ),
  }));

  if (Platform.OS === 'ios' && !forceCustom) {
    return (
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDarkMode ? '#3C4043' : '#BDC1C6', true: theme.tint }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={isDarkMode ? '#3C4043' : '#BDC1C6'}
        disabled={disabled}
      />
    );
  }

  return (
    <Pressable 
      onPressIn={() => (isPressed.value = true)}
      onPressOut={() => (isPressed.value = false)}
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[styles.track, rTrackStyle]}>
        <Animated.View style={[styles.thumb, rThumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
