import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTION_WIDTH = 80;
const FULL_SWIPE_THRESHOLD = SCREEN_WIDTH * 0.5;

interface ChatListElementProps {
  title: string;
  subtitle?: string;
  time?: string;
  unreadCount?: number;
  avatarUrl?: string;
  onPress: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

export const ChatListElement: React.FC<ChatListElementProps> = ({
  title,
  subtitle,
  time,
  unreadCount = 0,
  avatarUrl,
  onPress,
  onDelete,
  onArchive,
}) => {
  const { theme } = useAppTheme();
  const isAndroid = Platform.OS === 'android';
  
  const translateX = useSharedValue(0);
  const context = useSharedValue(0);
  const hasTriggeredFull = useSharedValue(false);

  const finalizeAction = (side: 'left' | 'right') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (side === 'right') onDelete();
    else onArchive();
    
    // Animate row fully away
    translateX.value = withTiming(side === 'right' ? -SCREEN_WIDTH : SCREEN_WIDTH, { duration: 250 }, () => {
        translateX.value = 0; // Reset for reuse (usually row would be removed from list)
    });
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateX.value;
      hasTriggeredFull.value = false;
    })
    .onUpdate((event) => {
      const nextX = event.translationX + context.value;
      translateX.value = nextX;

      // Haptic pop when crossing the full-swipe threshold
      if (Math.abs(nextX) > FULL_SWIPE_THRESHOLD && !hasTriggeredFull.value) {
        hasTriggeredFull.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (Math.abs(nextX) < FULL_SWIPE_THRESHOLD && hasTriggeredFull.value) {
        hasTriggeredFull.value = false;
      }
    })
    .onEnd((event) => {
      if (translateX.value > FULL_SWIPE_THRESHOLD) {
        runOnJS(finalizeAction)('left');
      } else if (translateX.value < -FULL_SWIPE_THRESHOLD) {
        runOnJS(finalizeAction)('right');
      } else if (translateX.value > ACTION_WIDTH / 2) {
        translateX.value = withTiming(ACTION_WIDTH);
      } else if (translateX.value < -ACTION_WIDTH / 2) {
        translateX.value = withTiming(-ACTION_WIDTH);
      } else {
        translateX.value = withTiming(0);
      }
    });

  const rRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // WhatsApp-style background: grows from the edge
  const rLeftBgStyle = useAnimatedStyle(() => ({
    width: Math.max(0, translateX.value),
    backgroundColor: '#007AFF', // Archive
  }));

  const rRightBgStyle = useAnimatedStyle(() => ({
    width: Math.max(0, -translateX.value),
    backgroundColor: '#FF3B30', // Delete
  }));

  const rIconStyle = (side: 'left' | 'right') => useAnimatedStyle(() => {
    const val = side === 'left' ? translateX.value : -translateX.value;
    // Icon stays centered in the revealed space until it hits ACTION_WIDTH, then stays pinned
    const padding = interpolate(val, [0, ACTION_WIDTH], [0, (ACTION_WIDTH - 24) / 2], Extrapolate.CLAMP);
    const scale = interpolate(val, [0, ACTION_WIDTH, FULL_SWIPE_THRESHOLD], [0.5, 1, 1.2], Extrapolate.CLAMP);
    
    return {
      opacity: interpolate(val, [0, 20], [0, 1], Extrapolate.CLAMP),
      transform: [{ scale }],
      [side]: padding,
    };
  });

  return (
    <View style={styles.container}>
      {/* Background Actions */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.backgroundContent}>
          <Animated.View style={[styles.bgAction, rLeftBgStyle, { left: 0 }]}>
            <Animated.View style={[styles.iconContainer, rIconStyle('left')]}>
              <Ionicons name="archive" size={24} color="#FFFFFF" />
            </Animated.View>
          </Animated.View>
          
          <Animated.View style={[styles.bgAction, rRightBgStyle, { right: 0 }]}>
            <Animated.View style={[styles.iconContainer, rIconStyle('right')]}>
              <Ionicons name="trash" size={24} color="#FFFFFF" />
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[rRowStyle, { backgroundColor: theme.background }]}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={onPress}
            style={styles.content}
          >
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
                  <Text style={[styles.avatarText, { color: theme.tabIconDefault }]}>
                    {title.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.textContainer}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {title}
                </Text>
                {time && (
                  <Text style={[styles.time, { color: theme.tabIconDefault }]}>
                    {time}
                  </Text>
                )}
              </View>
              
              <View style={styles.messageRow}>
                <Text style={[styles.subtitle, { color: theme.tabIconDefault }]} numberOfLines={1}>
                  {subtitle}
                </Text>
                {unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
          {!isAndroid && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
  },
  backgroundContent: {
    flex: 1,
    flexDirection: 'row',
  },
  bgAction: {
    position: 'absolute',
    height: '100%',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'absolute',
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 13,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 80,
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
  },
});
