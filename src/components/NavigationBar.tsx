import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NavigationBarProps {
  title?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  title,
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  style,
  children,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const renderContent = () => (
    <View style={[styles.content, { marginTop: insets.top }]}>
      {children ? (
        children
      ) : (
        <>
          <View style={styles.leftContainer}>
            {leftIcon && (
              <TouchableOpacity onPress={onLeftPress} style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name={leftIcon} size={26} color={theme.tint} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.titleContainer}>
            {title && (
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {title}
              </Text>
            )}
          </View>

          <View style={styles.rightContainer}>
            {rightIcon && (
              <TouchableOpacity onPress={onRightPress} style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name={rightIcon} size={26} color={theme.tint} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );

  const headerHeight = (Platform.OS === 'ios' ? 44 : 56) + insets.top;

  return (
    <View style={[styles.container, { height: headerHeight, backgroundColor: theme.background }, style]}>
      {renderContent()}
      <View style={[styles.border, { backgroundColor: theme.border }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 3,
    alignItems: 'center',
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  iconButton: {
    padding: 8,
  },
  border: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
});
