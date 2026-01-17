import React from 'react';
import { StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';

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

  // Map custom types to Paper modes
  let mode: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal' = 'contained';
  let buttonColor: string | undefined = color || theme.tint;
  let contentColor: string | undefined = undefined; // Let Paper handle contrast by default

  if (type === 'primary') {
    mode = 'contained';
  } else if (type === 'secondary') {
    mode = 'contained-tonal';
    buttonColor = (theme as any).secondaryContainer;
    contentColor = (theme as any).onSecondaryContainer;
  } else if (type === 'outline') {
    mode = 'outlined';
    buttonColor = undefined;
    contentColor = color || theme.tint;
  } else if (type === 'ghost') {
    mode = 'text';
    buttonColor = undefined;
    contentColor = color || theme.tint;
  }

  if (customTextColor) contentColor = customTextColor;

  return (
    <View style={style}>
      <PaperButton
        mode={mode}
        onPress={onPress}
        onLongPress={onLongPress}
        loading={loading}
        disabled={disabled}
        icon={icon ? ({ size, color }) => <Ionicons name={icon} size={size} color={color} /> : undefined}
        buttonColor={buttonColor}
        textColor={contentColor}
        contentStyle={[
          size === 'small' && { height: 32 },
          size === 'large' && { height: 56 },
          iconPosition === 'right' && { flexDirection: 'row-reverse' }
        ]}
        labelStyle={[
          size === 'small' && { fontSize: 12, marginVertical: 4 },
          size === 'large' && { fontSize: 16 },
          textStyle
        ]}
      >
        {title}
      </PaperButton>
    </View>
  );
};

const styles = StyleSheet.create({
});
