import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { TouchableRipple, Surface, Icon, Text as RNPText } from 'react-native-paper';

export interface SettingsTileProps {
  title: string;
  icon: string;
  onPress?: () => void;
  disabled?: boolean;
  surfaceColor?: string;
  iconBackgroundColor?: string;
  iconColor?: string;
  textColor?: string;
  rightElement?: 'chevron' | 'text';
  rightText?: string;
  rippleColor?: string;
  sideChild?: ReactNode;
  sideInput?: ReactNode;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
}

export function SettingsTile({
  title,
  icon,
  onPress,
  disabled = false,
  surfaceColor,
  iconBackgroundColor,
  iconColor,
  textColor,
  rightElement,
  rightText,
  rippleColor,
  sideChild,
  sideInput,
  elevation = 1,
}: SettingsTileProps) {
  return (
    <Surface style={[styles.surface, surfaceColor ? { backgroundColor: surfaceColor } : {}]} elevation={elevation}>
      <TouchableRipple
        onPress={onPress}
        disabled={!onPress || disabled}
        style={styles.item}
        android_ripple={{ color: rippleColor || 'rgba(0, 0, 0, 0.2)' }}
      >
        <View style={styles.itemContent}>
          <View style={[styles.iconContainer, iconBackgroundColor ? { backgroundColor: iconBackgroundColor } : {}]}>
            <Icon
              source={icon}
              size={16}
              color={iconColor || '#757575'}
            />
          </View>
          <RNPText variant="bodyMedium" style={[styles.text, textColor ? { color: textColor } : {}]}>
            {title}
          </RNPText>
          {sideChild}
          {sideInput && <View style={styles.sideInput}>{sideInput}</View>}
          {rightElement === 'chevron' && (
            <View style={{ marginLeft: 8 }}>
              <Icon source="chevron-right" size={20} color="#757575" />
            </View>
          )}
          {rightElement === 'text' && rightText && (
            <RNPText variant="bodyMedium" style={{ color: '#757575', marginLeft: 8 }}>
              {rightText}
            </RNPText>
          )}
        </View>
      </TouchableRipple>
    </Surface>
  );
}

export default SettingsTile;

const styles = StyleSheet.create({
  surface: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  item: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  text: {
    flex: 1,
    fontWeight: '500',
  },
  sideInput: {
    marginLeft: 8,
  },
});
