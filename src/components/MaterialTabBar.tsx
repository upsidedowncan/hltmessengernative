import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useAppTheme } from '../context/FeatureFlagContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_CONTENT_HEIGHT = 64;
const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;

export const MaterialTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const tabWidth = SCREEN_WIDTH / state.routes.length;
  
  const leftBound = useSharedValue(state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2);
  const rightBound = useSharedValue(leftBound.value + PILL_WIDTH);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (isDragging.value) return;

    const newLeft = state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2;
    const newRight = newLeft + PILL_WIDTH;

    const springConfig = { damping: 20, stiffness: 150 };

    if (newLeft > leftBound.value) {
      rightBound.value = withSpring(newRight, springConfig);
      leftBound.value = withDelay(60, withSpring(newLeft, springConfig));
    } else {
      leftBound.value = withSpring(newLeft, springConfig);
      rightBound.value = withDelay(60, withSpring(newRight, springConfig));
    }
  }, [state.index]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      const currentPos = state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2;
      const fingerLeft = currentPos + event.translationX;
      
      const dragSpringConfig = { damping: 18, stiffness: 120 };
      
      if (event.velocityX > 0) {
        rightBound.value = fingerLeft + PILL_WIDTH;
        leftBound.value = withSpring(fingerLeft, dragSpringConfig);
      } else if (event.velocityX < 0) {
        leftBound.value = fingerLeft;
        rightBound.value = withSpring(fingerLeft + PILL_WIDTH, dragSpringConfig);
      } else {
        leftBound.value = fingerLeft;
        rightBound.value = fingerLeft + PILL_WIDTH;
      }
    })
    .onEnd((event) => {
      isDragging.value = false;
      
      const currentPos = state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2;
      const fingerLeft = currentPos + event.translationX;
      
      // Momentum calculation: Where would the pill end up if it kept moving?
      const momentumX = event.velocityX * 0.1; // 100ms projection
      const projectedLeft = fingerLeft + momentumX;
      const projectedCenter = projectedLeft + PILL_WIDTH / 2;
      
      // Determine target tab based on projected center
      let targetIndex = Math.floor(projectedCenter / tabWidth);
      
      // Velocity-based "flick" override
      const flickThreshold = 300;
      if (Math.abs(event.velocityX) > flickThreshold) {
        targetIndex = event.velocityX > 0 ? state.index + 1 : state.index - 1;
      }
      
      const clampedIndex = Math.max(0, Math.min(state.routes.length - 1, targetIndex));

      if (clampedIndex !== state.index) {
        runOnJS(navigation.navigate)(state.routes[clampedIndex].name);
      } else {
        // Snap back to current tab with a bouncy spring
        const snapLeft = state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2;
        const snapConfig = { damping: 15, stiffness: 200, mass: 0.8 };
        leftBound.value = withSpring(snapLeft, snapConfig);
        rightBound.value = withSpring(snapLeft + PILL_WIDTH, snapConfig);
      }
    });

  const animatedPillStyle = useAnimatedStyle(() => ({
    left: leftBound.value,
    width: Math.max(PILL_WIDTH, rightBound.value - leftBound.value),
    transform: [
      { translateY: (TAB_BAR_CONTENT_HEIGHT - PILL_HEIGHT) / 2 }
    ],
  }));

  const renderIcons = (active: boolean) => (
    <View style={styles.iconLayer}>
      {state.routes.map((route, index) => {
        let iconName: keyof typeof Ionicons.glyphMap;
        if (route.name === 'Chat') iconName = active ? 'chatbubbles' : 'chatbubbles-outline';
        else if (route.name === 'Friends') iconName = active ? 'people' : 'people-outline';
        else if (route.name === 'Profile') iconName = active ? 'person' : 'person-outline';
        else iconName = 'alert';

        return (
          <View key={route.key} style={styles.tabItem}>
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={iconName} 
                size={24} 
                color={active ? '#FFFFFF' : theme.tabIconDefault} 
              />
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: theme.background,
        paddingBottom: insets.bottom,
        height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
        borderTopColor: theme.border,
      }
    ]}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.content}>
          {/* Layer 1: Inactive Icons */}
          {renderIcons(false)}

          {/* Layer 2: Moving Pill */}
          <Animated.View style={[
            styles.pill, 
            { 
              backgroundColor: theme.tint,
              height: PILL_HEIGHT,
              borderRadius: PILL_HEIGHT / 2,
            },
            animatedPillStyle
          ]} />

          {/* Layer 3: Active Icons (Masked by Pill) */}
          <Animated.View style={[
            styles.maskedLayer,
            animatedPillStyle,
            { height: PILL_HEIGHT, borderRadius: PILL_HEIGHT / 2 }
          ]}>
             <Animated.View style={[
               styles.activeIconContainer, 
               { 
                 width: SCREEN_WIDTH, 
                 top: -(TAB_BAR_CONTENT_HEIGHT - PILL_HEIGHT) / 2 
               },
               useAnimatedStyle(() => ({
                 left: -leftBound.value
               }))
             ]}>
               {renderIcons(true)}
             </Animated.View>
          </Animated.View>
          
          {/* Invisible Touch Layer */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={styles.iconLayer}>
              {state.routes.map((route, index) => (
                <TouchableOpacity
                  key={route.key}
                  onPress={() => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name);
                  }}
                  style={styles.tabItem}
                  activeOpacity={1}
                />
              ))}
            </View>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
  },
  content: {
    height: TAB_BAR_CONTENT_HEIGHT,
    width: '100%',
  },
  iconLayer: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    position: 'absolute',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    height: PILL_HEIGHT,
    width: PILL_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
  },
  maskedLayer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  activeIconContainer: {
    height: TAB_BAR_CONTENT_HEIGHT,
    position: 'absolute',
  },
});