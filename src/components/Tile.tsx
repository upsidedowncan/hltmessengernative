import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  ViewStyle,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export type TileGroupPosition = 'top' | 'middle' | 'bottom' | 'none';

interface TileProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconBackgroundColor?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  groupPosition?: TileGroupPosition;
  destructive?: boolean;
  chevron?: boolean;
  style?: ViewStyle;
}

export const Tile: React.FC<TileProps> = ({
  title,
  subtitle,
  icon,
  iconBackgroundColor,
  onPress,
  rightElement,
  groupPosition = 'none',
  destructive = false,
  chevron = true,
  style,
}) => {
  const { theme, isDarkMode } = useTheme();
  const isAndroid = Platform.OS === 'android';

  const getBorderRadii = () => {
    return { borderRadius: 0 };
  };

  const renderContent = (pressed?: boolean) => {
    // Make background lighter when pressed, especially in dark mode
    const highlightColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.02)';
    const backgroundColor = pressed ? highlightColor : theme.cardBackground;

    return (
      <View style={[
        styles.container,
        { backgroundColor },
        getBorderRadii(),
        style
      ]}>
        <View style={styles.content}>
          {icon && (
            <View style={[
              styles.iconContainer,
              { 
                backgroundColor: 'transparent'
              }
            ]}>
              <Ionicons 
                name={icon} 
                size={24} 
                color={destructive ? '#ef5350' : theme.text}
              />
            </View>
          )}
          
          <View style={styles.textContainer}>
            <Text 
              style={[
                styles.title, 
                { color: destructive ? '#ef5350' : theme.text }
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>

          <View style={styles.rightContainer}>
            {rightElement}
            {chevron && onPress && !rightElement && (
              <Ionicons name="chevron-forward" size={18} color="#C4C4C6" />
            )}
          </View>
        </View>
        
        {(groupPosition === 'top' || groupPosition === 'middle') && (
          <View style={[
            styles.separator, 
            { 
              backgroundColor: pressed ? 'transparent' : theme.border, 
              left: icon ? 60 : 16 
            }
          ]} />
        )}
      </View>
    );
  };

  if (onPress) {
    return (
      <Pressable 
        onPress={onPress}
        style={({ pressed }) => [
             style,
             // Apply border radius to the pressable wrapper too so ripple is clipped (Android)
             getBorderRadii(),
             { overflow: 'hidden' } 
        ]}
        android_ripple={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
      >
        {({ pressed }) => renderContent(pressed)}
      </Pressable>
    );
  }

  return renderContent();
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden', // Ensure children don't bleed out of rounded corners
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: 52,
    paddingVertical: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '400',
    fontSize: 17,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});