import React from 'react';
import { TouchableRipple as PaperTouchableRipple } from 'react-native-paper';
import { type PressableAndroidRippleConfig } from 'react-native';

export type TouchableRippleProps = React.ComponentProps<typeof PaperTouchableRipple> & {
  rippleColor?: string;
  underlayColor?: string;
};

export const TouchableRipple = ({
  rippleColor,
  underlayColor,
  borderless,
  ...rest
}: TouchableRippleProps) => {
  const color = rippleColor || underlayColor || 'rgba(0,0,0,0.12)';

  return (
    <PaperTouchableRipple
      {...rest}
      rippleColor={rippleColor}
      underlayColor={underlayColor || color}
      borderless={borderless ?? false}
      background={
        {
          color,
          foreground: true,
        } as PressableAndroidRippleConfig
      }
    />
  );
};

export default TouchableRipple;
