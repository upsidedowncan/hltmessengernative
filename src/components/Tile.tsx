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
import { useAppTheme } from '../context/FeatureFlagContext';

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
  const { theme, isDarkMode } = useAppTheme();
  const isAndroid = Platform.OS === 'android';

  const getBorderRadii = () => {
    if (isAndroid) return { borderRadius: 0 };
    const radius = 10;
    if (groupPosition === 'top') return { borderTopLeftRadius: radius, borderTopRightRadius: radius };
    if (groupPosition === 'bottom') return { borderBottomLeftRadius: radius, borderBottomRightRadius: radius };
    if (groupPosition === 'middle') return { borderRadius: 0 };
    return { borderRadius: radius };
  };

  const renderContent = (pressed?: boolean) => {
    // iOS Highlight color: System Gray 4 equivalent
    const iosHighlightColor = isDarkMode ? '#3A3A3C' : '#D1D1D6';
    const backgroundColor = !isAndroid 
      ? (pressed ? iosHighlightColor : theme.cardBackground) 
      : 'transparent';

    return (
      <View style={[
        styles.container,
        !isAndroid && { backgroundColor },
        !isAndroid && getBorderRadii(),
        style
      ]}>
        <View style={[styles.content, isAndroid ? styles.contentAndroid : styles.contentIOS]}>
          {icon && (
            <View style={[
              styles.iconContainer,
              isAndroid ? styles.iconContainerAndroid : styles.iconContainerIOS,
              { 
                backgroundColor: iconBackgroundColor || 
                  (destructive ? (isAndroid ? '#FAD2CF' : '#FF3B30') : 
                  (isAndroid ? (isDarkMode ? '#3C4043' : '#F1F3F4') : '#8E8E93')) 
              }
            ]}>
              <Ionicons 
                name={icon} 
                size={isAndroid ? 22 : 20} 
                color={isAndroid 
                  ? (destructive ? '#D93025' : (iconBackgroundColor ? '#FFFFFF' : theme.tint)) 
                  : "#FFFFFF"
                } 
                style={!isAndroid ? { marginTop: 0.5 } : null}
              />
            </View>
          )}
          
          <View style={styles.textContainer}>
            <Text 
              style={[
                styles.title, 
                isAndroid ? styles.titleAndroid : styles.titleIOS,
                { color: destructive ? (isAndroid ? '#D93025' : '#FF3B30') : theme.text }
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text 
                style={[
                  isAndroid ? styles.subtitleAndroid : styles.subtitleIOS, 
                  { color: theme.tabIconDefault }
                ]} 
                numberOfLines={isAndroid ? 2 : 1}
              >
                {subtitle}
              </Text>
            )}
          </View>

          <View style={styles.rightContainer}>
            {rightElement}
            {chevron && onPress && !rightElement && !isAndroid && (
              <Ionicons name="chevron-forward" size={18} color="#C4C4C6" />
            )}
          </View>
        </View>
        
        {!isAndroid && (groupPosition === 'top' || groupPosition === 'middle') && (
          <View style={[
            styles.separator, 
            { 
              backgroundColor: pressed ? 'transparent' : theme.border, 
              left: icon ? 56 : 16 
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
        style={style}
        android_ripple={isAndroid ? { color: 'rgba(0, 0, 0, 0.08)' } : undefined}
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
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  contentIOS: {
    minHeight: 44,
    paddingVertical: 10,
  },
  contentAndroid: {
    minHeight: 72,
    paddingVertical: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainerIOS: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 12,
  },
  iconContainerAndroid: {
    width: 40,
    height: 40,
    borderRadius: 20, 
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '400',
  },
  titleIOS: {
    fontSize: 17,
  },
  titleAndroid: {
    fontSize: 16,
    marginBottom: 1,
  },
  subtitleIOS: {
    display: 'none',
  },
  subtitleAndroid: {
    fontSize: 14,
    lineHeight: 20,
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