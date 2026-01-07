import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue, 
  interpolateColor 
} from 'react-native-reanimated';

export type GroupPosition = 'top' | 'middle' | 'bottom' | 'none';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  groupPosition?: GroupPosition;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  labelStyle,
  secureTextEntry,
  onFocus,
  onBlur,
  groupPosition = 'none',
  ...props
}) => {
  const { theme } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);
  
  const focusAnim = useSharedValue(0);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
    if (onBlur) onBlur(e);
  };

  const getBorderRadii = () => {
    const radius = Platform.OS === 'android' ? 4 : 12;
    if (groupPosition === 'top') return { borderTopLeftRadius: radius, borderTopRightRadius: radius };
    if (groupPosition === 'bottom') return { borderBottomLeftRadius: radius, borderBottomRightRadius: radius };
    if (groupPosition === 'middle') return { borderRadius: 0 };
    return { borderRadius: radius };
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focusAnim.value,
      [0, 1],
      [theme.border, theme.tint]
    );

    return {
      borderColor: error ? '#ef5350' : borderColor,
      borderWidth: Platform.OS === 'android' ? (isFocused || error ? 2 : 1) : 1,
      zIndex: isFocused || error ? 1 : 0,
    };
  });

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const renderRightIcon = () => {
    if (secureTextEntry) {
      return (
        <TouchableOpacity onPress={togglePasswordVisibility} style={styles.iconButton}>
          <Ionicons 
            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} 
            size={20} 
            color={theme.tabIconDefault} 
          />
        </TouchableOpacity>
      );
    }
    
    if (rightIcon) {
      return (
        <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress} style={styles.iconButton}>
          <Ionicons name={rightIcon} size={20} color={theme.tabIconDefault} />
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  return (
    <View style={[
      styles.container, 
      groupPosition !== 'none' && groupPosition !== 'bottom' && { marginBottom: 0 },
      containerStyle
    ]}>
      {label && groupPosition === 'none' && (
        <Text style={[
          styles.label, 
          { color: theme.text }, 
          error ? { color: '#ef5350' } : null,
          labelStyle
        ]}>
          {label}
        </Text>
      )}
      
      <Animated.View style={[
        styles.inputWrapper, 
        { 
          backgroundColor: theme.cardBackground,
          marginTop: groupPosition === 'middle' || groupPosition === 'bottom' ? -1 : 0,
        },
        getBorderRadii(),
        animatedContainerStyle
      ]}>
        {leftIcon && (
          <Ionicons 
            name={leftIcon} 
            size={20} 
            color={isFocused ? theme.tint : theme.tabIconDefault} 
            style={styles.leftIcon} 
          />
        )}
        
        <TextInput
          style={[
            styles.input, 
            { color: theme.text },
            inputStyle
          ]}
          placeholder={label && groupPosition !== 'none' ? label : props.placeholder}
          placeholderTextColor={theme.tabIconDefault}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          selectionColor={theme.tint}
          underlineColorAndroid="transparent"
          {...props}
        />
        
        {renderRightIcon()}
      </Animated.View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    opacity: 0.9,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        paddingTop: 12, // Center text vertically on iOS
      },
      android: {
        textAlignVertical: 'center',
      },
    }),
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    color: '#ef5350',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
});
