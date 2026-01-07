import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  title: string;
  description: string;
  type: ToastType;
  id: string;
}

interface ToastProps {
  data: ToastData | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ data, onDismiss }) => {
  const { theme, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const translateY = useSharedValue(100);
  const expandProgress = useSharedValue(0); // 0 = collapsed, 1 = expanded
  const context = useSharedValue({ y: 0 });

  useEffect(() => {
    if (data) {
      // Entrance
      Haptics.notificationAsync(
        data.type === 'error' 
          ? Haptics.NotificationFeedbackType.Error 
          : Haptics.NotificationFeedbackType.Success
      );
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      // Exit
      translateY.value = withTiming(150, { duration: 250 });
      expandProgress.value = withTiming(0);
    }
  }, [data]);

  const dismiss = () => {
    'worklet';
    translateY.value = withTiming(150, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    });
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const nextY = event.translationY + context.value.y;
      
      if (nextY < 0) {
        // Pulling UP: Expand
        expandProgress.value = interpolate(nextY, [0, -60], [0, 1], Extrapolate.CLAMP);
        translateY.value = nextY * 0.2; // High resistance for expansion
      } else {
        // Pulling DOWN: Dismiss
        translateY.value = nextY;
      }
    })
    .onEnd((event) => {
      if (translateY.value > 40 || event.velocityY > 500) {
        dismiss();
      } else if (translateY.value < -20 || event.velocityY < -500) {
        // Snap to expanded
        expandProgress.value = withTiming(1, { duration: 250 });
        translateY.value = withTiming(0, { duration: 250 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Snap back
        translateY.value = withTiming(0, { duration: 200 });
        expandProgress.value = withTiming(0, { duration: 200 });
      }
    });

  const rContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    paddingBottom: interpolate(expandProgress.value, [0, 1], [12, 20]),
  }));

  const rDescriptionStyle = useAnimatedStyle(() => ({
    height: interpolate(expandProgress.value, [0, 1], [0, 60], Extrapolate.CLAMP),
    opacity: interpolate(expandProgress.value, [0, 0.5, 1], [0, 0, 1], Extrapolate.CLAMP),
    marginTop: interpolate(expandProgress.value, [0, 1], [0, 8], Extrapolate.CLAMP),
  }));

  const rIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 1], [0.4, 0]),
    transform: [{ translateY: interpolate(expandProgress.value, [0, 1], [0, -5]) }]
  }));

  if (!data) return null;

  const getColors = () => {
    switch (data.type) {
      case 'success': return { bg: isDarkMode ? '#1B3320' : '#E8F5E9', tint: '#4CAF50', icon: 'checkmark-circle' };
      case 'error': return { bg: isDarkMode ? '#331B1B' : '#FFEBEE', tint: '#F44336', icon: 'alert-circle' };
      case 'warning': return { bg: isDarkMode ? '#332B1B' : '#FFF3E0', tint: '#FF9800', icon: 'warning' };
      default: return { bg: isDarkMode ? '#1B2633' : '#E3F2FD', tint: '#2196F3', icon: 'information-circle' };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[
          styles.container, 
          { backgroundColor: colors.bg, borderColor: colors.tint + '40' },
          rContainerStyle
        ]}>
          <View style={styles.header}>
            <Ionicons name={colors.icon as any} size={24} color={colors.tint} />
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: theme.text }]}>{data.title}</Text>
              <Animated.View style={[styles.pullIndicator, rIndicatorStyle]}>
                <Ionicons name="chevron-up" size={12} color={theme.tabIconDefault} />
                <Text style={styles.pullText}>Pull for info</Text>
              </Animated.View>
            </View>
          </View>

          <Animated.View style={[styles.descriptionContainer, rDescriptionStyle]}>
            <Text style={[styles.description, { color: theme.text }]}>
              {data.description}
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  descriptionContainer: {
    overflow: 'hidden',
    marginLeft: 36,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  pullIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pullText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
});
