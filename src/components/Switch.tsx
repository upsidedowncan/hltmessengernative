import React from 'react';
import {
  Platform,
  Switch as RNSwitch,
} from 'react-native';
import { useAppTheme } from '../context/FeatureFlagContext';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * Switch component using the native React Native Switch.
 */
export const Switch: React.FC<SwitchProps> = ({ 
  value, 
  onValueChange, 
  disabled = false,
}) => {
  const { theme, isDarkMode } = useAppTheme();

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ 
        false: isDarkMode ? '#3C4043' : '#BDC1C6', 
        true: theme.tint 
      }}
      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (value ? theme.tint : '#f4f3f4')}
      ios_backgroundColor={isDarkMode ? '#3C4043' : '#BDC1C6'}
      disabled={disabled}
    />
  );
};
