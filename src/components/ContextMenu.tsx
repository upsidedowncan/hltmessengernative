import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Platform,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS,
  interpolate,
  Easing,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ContextMenuItem {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  anchorPosition?: { x: number, y: number };
  behindContent?: React.ReactNode;
  forceCustom?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  onClose,
  items,
  anchorPosition = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 },
  behindContent,
  forceCustom = false,
}) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [shouldRender, setShouldRender] = useState(visible);
  
  const progress = useSharedValue(0);

  const isIOS = Platform.OS === 'ios' || forceCustom;
  const menuWidth = isIOS ? 250 : 220;
  const itemHeight = isIOS ? 44 : 48;
  const menuHeight = items.length * itemHeight + (isIOS ? 0 : 16);
  
  // Logic: Prefer below finger, flip to above if no space
  const FINGER_GAP = 12;
  const isBelow = anchorPosition.y + menuHeight + FINGER_GAP < SCREEN_HEIGHT - insets.bottom - 20;
  
  const top = isBelow 
    ? anchorPosition.y + FINGER_GAP 
    : anchorPosition.y - menuHeight - FINGER_GAP;
    
  const left = Math.max(16, Math.min(anchorPosition.x - (menuWidth / 2), SCREEN_WIDTH - menuWidth - 16));

  const rOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const rContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.1, 1], Extrapolate.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 1, 1], Extrapolate.CLAMP);
    
    // Pivot points: Lock to the edge closest to the finger
    const pivotX = anchorPosition.x - left;
    const pivotY = isBelow ? 0 : menuHeight;

    return {
      opacity,
      transform: [
        { translateX: (pivotX - menuWidth / 2) * (scale - 1) },
        { translateY: (pivotY - menuHeight / 2) * (scale - 1) },
        { scale },
      ],
    };
  });

  const rBehindContentStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 0.96], Extrapolate.CLAMP);
    const borderRadius = interpolate(progress.value, [0, 1], [0, Platform.OS === 'ios' ? 38 : 16], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
      borderRadius,
      overflow: 'hidden',
    };
  });

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      progress.value = withTiming(1, { 
        duration: 350,
        easing: Easing.bezier(0.33, 1, 0.68, 1), 
      });
    } else {
      progress.value = withTiming(0, { 
        duration: 250,
        easing: Easing.out(Easing.quad),
      }, (finished) => {
        if (finished) runOnJS(setShouldRender)(false);
      });
    }
  }, [visible]);

  const renderItems = () => (
    <View style={isIOS ? styles.itemsContainerIOS : styles.itemsContainerAndroid}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const color = item.destructive ? '#FF3B30' : theme.text;

        return (
          <TouchableOpacity
            key={index}
            onPress={() => {
              item.onPress();
              onClose();
            }}
            style={[
              isIOS ? styles.itemIOS : styles.itemAndroid,
              !isLast && isIOS && styles.borderIOS,
              !isLast && isIOS && { borderBottomColor: theme.border }
            ]}
            activeOpacity={0.6}
          >
            <Text style={[isIOS ? styles.labelIOS : styles.labelAndroid, { color }]}>
              {item.label}
            </Text>
            {item.icon && (
              <Ionicons name={item.icon} size={isIOS ? 20 : 22} color={color} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.rootView}>
      {behindContent && (
        <Animated.View style={[styles.rootView, rBehindContentStyle]}>
          {behindContent}
        </Animated.View>
      )}

      <Modal transparent visible={shouldRender} animationType="none" onRequestClose={onClose}>
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.overlay, rOverlayStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          </Animated.View>

          <Animated.View 
            style={[
              isIOS ? styles.menuIOS : [styles.menuAndroid, { backgroundColor: theme.cardBackground }],
              rContainerStyle,
              {
                  position: 'absolute',
                  top,
                  left,
                  width: menuWidth,
              }
            ]}
          >
            {isIOS ? (
              <BlurView 
                intensity={Platform.OS === 'ios' ? 100 : 80} 
                tint={isDarkMode ? 'dark' : 'light'} 
                style={styles.blurContainer}
              >
                {renderItems()}
              </BlurView>
            ) : (
              renderItems()
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  rootView: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menuIOS: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  blurContainer: {
    padding: 0,
  },
  itemsContainerIOS: {
    padding: 0,
  },
  itemIOS: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  borderIOS: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelIOS: {
    fontSize: 17,
  },
  menuAndroid: {
    borderRadius: 4,
    elevation: 8,
    paddingVertical: 8,
  },
  itemsContainerAndroid: {
    padding: 0,
  },
  itemAndroid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  labelAndroid: {
    fontSize: 16,
  },
});
