import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Appbar } from 'react-native-paper';
import { useAppTheme } from '../context/FeatureFlagContext';

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

  return (
    <Appbar.Header style={[{ backgroundColor: theme.background }, style]} elevated>
      {leftIcon && (
        <Appbar.Action
          icon={({ size, color }) => <Ionicons name={leftIcon} size={size} color={color} />}
          onPress={onLeftPress}
          color={theme.text}
        />
      )}
      {children ? (
        children
      ) : (
        <Appbar.Content title={title || ''} titleStyle={{ color: theme.text, fontWeight: '600' }} />
      )}
      {rightIcon && (
        <Appbar.Action
          icon={({ size, color }) => <Ionicons name={rightIcon} size={size} color={color} />}
          onPress={onRightPress}
          color={theme.text}
        />
      )}
    </Appbar.Header>
  );
};

const styles = StyleSheet.create({
});
