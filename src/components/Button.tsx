import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Platform, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle, 
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useFeatureFlags } from '../context/FeatureFlagContext';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming 
} from 'react-native-reanimated';

export type ButtonType = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  onLongPress?: () => void;
  type?: ButtonType;
  size?: ButtonSize;
  color?: string;
  textColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  onLongPress,
  type = 'primary',
  size = 'medium',
  color,
  textColor: customTextColor,
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { theme } = useAppTheme();
  const { isEnabled } = useFeatureFlags();
  const isTrainMode = isEnabled('TRAIN_MODE');
  
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const [isPressed, setIsPressed] = useState(false);

  const getBackgroundColor = () => {
    if (isTrainMode) {
      return isPressed ? '#00ADEF' : 'black';
    }

    if (disabled) return theme.tabIconDefault + '50';
    if (type === 'outline' || type === 'ghost') return 'transparent';
    if (color) return color;
    
    switch (type) {
      case 'primary': return theme.tint;
      case 'secondary': return (theme as any).secondaryContainer;
      default: return theme.tint;
    }
  };

  const getTextColor = () => {
    if (isTrainMode) {
      // White text on black, Black text on lightblue for contrast
      return isPressed ? 'black' : 'white';
    }

    if (customTextColor) return customTextColor;
    if (disabled) return theme.tabIconDefault;
    
    switch (type) {
      case 'primary': return '#FFFFFF';
      case 'secondary': return (theme as any).onSecondaryContainer;
      case 'outline':
      case 'ghost': return color || theme.tint;
      default: return '#FFFFFF';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small': return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large': return { paddingVertical: 14, paddingHorizontal: 28 };
      default: return { paddingVertical: 12, paddingHorizontal: 24 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small': return 13;
      case 'large': return 16;
      default: return 14;
    }
  };

  const isAndroid = Platform.OS === 'android';
  const borderRadius = isTrainMode ? 0 : (isAndroid ? 24 : (size === 'small' ? 8 : 12));
  const activeTextColor = getTextColor();
  const backgroundColor = getBackgroundColor();
  
  const animBorderRadius = useSharedValue(borderRadius);

  React.useEffect(() => {
    animBorderRadius.value = withTiming(borderRadius, { duration: 200 });
  }, [borderRadius]);

  const animatedAndroidStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    borderRadius: animBorderRadius.value,
  }));

  const handlePressIn = () => {
    setIsPressed(true);
    if (isTrainMode || isAndroid) {
      scale.value = withTiming(isTrainMode ? 0.95 : 0.97, { duration: 100 });
      if (!isTrainMode) {
        opacity.value = withTiming(0.9, { duration: 100 });
        if (isAndroid) {
          animBorderRadius.value = withTiming(8, { duration: 200 });
        }
      }
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
    if (isTrainMode || isAndroid) {
      scale.value = withTiming(1, { duration: 100 });
      if (!isTrainMode) {
        opacity.value = withTiming(1, { duration: 100 });
        if (isAndroid) {
          animBorderRadius.value = withTiming(24, { duration: 200 });
        }
      }
    }
  };

  const content = (
    <View style={[
      styles.content,
      iconPosition === 'right' && { flexDirection: 'row-reverse' }
    ]}>
      {loading ? (
        <ActivityIndicator size="small" color={activeTextColor} />
      ) : (
        <>
          {icon && (
            <Ionicons 
              name={icon} 
              size={getFontSize() + 4} 
              color={activeTextColor} 
              style={iconPosition === 'left' ? { marginRight: 8 } : { marginLeft: 8 }} 
            />
          )}
          <Text style={[
            styles.text, 
            { 
              color: activeTextColor, 
              fontSize: getFontSize(),
              fontWeight: isTrainMode ? '300' : '600',
              textTransform: isTrainMode ? 'lowercase' : 'none',
              letterSpacing: 0,
            },
            textStyle
          ]}>
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const containerStyle: ViewStyle = {
    backgroundColor,
    borderRadius,
    borderWidth: isTrainMode ? 1 : (type === 'outline' ? 1 : 0),
    borderColor: isTrainMode ? 'white' : (type === 'outline' ? (color || theme.tint) : 'transparent'),
    minWidth: 64,
    ...getPadding(),
  };

  if (isAndroid || isTrainMode) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[styles.container, containerStyle, animatedAndroidStyle, style]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[styles.container, containerStyle, style]}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
