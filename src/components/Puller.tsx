import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  LayoutChangeEvent,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PullerProps {
  baseContent: React.ReactNode;
  expandedContent: React.ReactNode;
  gestureEnabled?: boolean;
  onStateChange?: (expanded: boolean) => void;
  position?: 'top' | 'bottom';
}

export interface PullerRef {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
}

export const Puller = forwardRef<PullerRef, PullerProps>(({ 
  baseContent, 
  expandedContent, 
  gestureEnabled = true,
  onStateChange,
  position = 'bottom'
}, ref) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [baseHeight, setBaseHeight] = useState(0);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);
  
  const progress = useSharedValue(0);
  const isExpanded = useSharedValue(false);

  const scrollTo = (targetProgress: number) => {
    'worklet';
    progress.value = withSpring(targetProgress, { 
      damping: 20, 
      stiffness: 150,
      mass: 0.8
    });
    isExpanded.value = targetProgress === 1;
    if (onStateChange) runOnJS(onStateChange)(targetProgress === 1);
  };

  useImperativeHandle(ref, () => ({
    expand: () => scrollTo(1),
    collapse: () => scrollTo(0),
    toggle: () => {
      if (isExpanded.value) scrollTo(0);
      else scrollTo(1);
    }
  }), [expandedHeight, scrollTo]);

  const onLayoutBase = (event: LayoutChangeEvent) => {
    setBaseHeight(event.nativeEvent.layout.height);
  };

  const onLayoutExpanded = (event: LayoutChangeEvent) => {
    setExpandedHeight(event.nativeEvent.layout.height);
  };

  const context = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .enabled(gestureEnabled)
    .onStart(() => {
      context.value = progress.value;
    })
    .onUpdate((event) => {
      if (expandedHeight === 0) return;
      const delta = position === 'bottom' ? -event.translationY : event.translationY;
      const newProgress = context.value + (delta / expandedHeight);
      progress.value = Math.max(0, Math.min(1, newProgress));
    })
    .onEnd((event) => {
      const velocity = position === 'bottom' ? -event.velocityY : event.velocityY;
      if (velocity > 300 || progress.value > 0.5) { // Lowered velocity threshold
        scrollTo(1);
      } else {
        scrollTo(0);
      }
    });

  const rExpandedStyle = useAnimatedStyle(() => ({
    height: progress.value * expandedHeight,
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0, 1], Extrapolate.CLAMP),
  }));

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: theme.cardBackground,
        borderTopColor: theme.border,
        borderTopWidth: position === 'bottom' ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: theme.border,
        borderBottomWidth: position === 'top' ? StyleSheet.hairlineWidth : 0,
        paddingBottom: position === 'bottom' ? (Platform.OS === 'android' && isKeyboardVisible ? 0 : insets.bottom) : 0,
        paddingTop: position === 'top' ? insets.top : 0,
      }
    ]}>
      <GestureDetector gesture={panGesture}>
        <View style={{ width: '100%' }}>
          {position === 'top' && (
            <Animated.View style={[styles.expandedArea, rExpandedStyle]}>
              <View onLayout={onLayoutExpanded} style={styles.measureContainer}>
                {expandedContent}
              </View>
            </Animated.View>
          )}

          <View onLayout={onLayoutBase} style={styles.baseArea}>
            {baseContent}
          </View>

          {position === 'bottom' && (
            <Animated.View style={[styles.expandedArea, rExpandedStyle]}>
              <View onLayout={onLayoutExpanded} style={styles.measureContainer}>
                {expandedContent}
              </View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  baseArea: {
    width: '100%',
  },
  expandedArea: {
    width: '100%',
    overflow: 'hidden',
  },
  measureContainer: {
    position: 'absolute',
    width: '100%',
    top: 0,
  },
});
