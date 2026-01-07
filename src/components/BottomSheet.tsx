import React, { useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Platform,
  LayoutChangeEvent,
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
import { useAppTheme } from '../context/FeatureFlagContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH > 600;

interface BottomSheetProps {
  children: React.ReactNode;
  /** The main content of the screen that should scale down */
  behindContent?: React.ReactNode;
  onClose?: () => void;
  maxHeight?: number;
}

export interface BottomSheetRef {
  expand: () => void;
  close: () => void;
}

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({ 
  children, 
  behindContent,
  onClose,
  maxHeight
}, ref) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const [contentHeight, setContentHeight] = useState(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  const activeHeight = Math.min(contentHeight + insets.bottom + 40, maxHeight || SCREEN_HEIGHT * 0.9);

  const scrollTo = useCallback((destination: number) => {
    'worklet';
    translateY.value = withSpring(destination, { 
      damping: 14, 
      stiffness: 100,
      mass: 0.6,
    });
  }, []);

  useImperativeHandle(ref, () => ({
    expand: () => scrollTo(-activeHeight),
    close: () => scrollTo(0),
  }), [activeHeight, scrollTo]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setContentHeight(height);
    }
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const nextY = event.translationY + context.value.y;
      translateY.value = Math.max(-activeHeight - 50, Math.min(0, nextY));
    })
    .onEnd((event) => {
      if (event.velocityY > 500 || translateY.value > -activeHeight / 1.5) {
        scrollTo(0);
        if (onClose) runOnJS(onClose)();
      } else {
        scrollTo(-activeHeight);
      }
    });

  const rBottomSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      borderTopLeftRadius: interpolate(translateY.value, [-SCREEN_HEIGHT, -SCREEN_HEIGHT + 100], [0, 28], Extrapolate.CLAMP),
      borderTopRightRadius: interpolate(translateY.value, [-SCREEN_HEIGHT, -SCREEN_HEIGHT + 100], [0, 28], Extrapolate.CLAMP),
    };
  });

  const rBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-activeHeight, 0], [1, 0], Extrapolate.CLAMP),
    pointerEvents: translateY.value === 0 ? 'none' : 'auto',
  }));

  // New depth animation style for the content behind the sheet
  const rBehindContentStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateY.value,
      [-activeHeight, 0],
      [0.94, 1], // Scale down to 94%
      Extrapolate.CLAMP
    );

    const borderRadius = interpolate(
      translateY.value,
      [-activeHeight, 0],
      [Platform.OS === 'ios' ? 44 : 16, 0], // Smoothly round corners
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
      borderRadius,
      overflow: 'hidden',
    };
  });

  const containerWidth = IS_TABLET ? 600 : SCREEN_WIDTH;
  const horizontalPadding = IS_TABLET ? (SCREEN_WIDTH - 600) / 2 : 0;

  return (
    <View style={styles.root}>
      {behindContent && (
        <Animated.View style={[styles.root, rBehindContentStyle]}>
          {behindContent}
        </Animated.View>
      )}

      <GestureDetector gesture={Gesture.Tap().onEnd(() => {
        scrollTo(0);
        if (onClose) runOnJS(onClose)();
      })}>
        <Animated.View style={[styles.backdrop, rBackdropStyle]} />
      </GestureDetector>
      
      <GestureDetector gesture={gesture}>
        <Animated.View 
          style={[
            styles.bottomSheetContainer, 
            { 
              backgroundColor: theme.cardBackground,
              width: containerWidth,
              left: horizontalPadding,
            },
            rBottomSheetStyle
          ]}
        >
          <View style={styles.handle} />
          <View onLayout={onLayout} style={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}>
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bottomSheetContainer: {
    height: SCREEN_HEIGHT,
    position: 'absolute',
    top: SCREEN_HEIGHT,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  contentContainer: {},
  handle: {
    width: 36,
    height: 5,
    backgroundColor: '#8E8E93',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 3,
    opacity: 0.3,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  },
});