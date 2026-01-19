import React from 'react';
import { Switch as PaperSwitch } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * Switch component using react-native-paper Switch.
 */
export const Switch: React.FC<SwitchProps> = ({ 
  value, 
  onValueChange, 
  disabled = false,
}) => {
  const { theme } = useTheme();

  return (
    <PaperSwitch
      value={value}
      onValueChange={onValueChange}
      color={theme.tint}
      disabled={disabled}
    />
  );
};
