import React from 'react';
import { TouchableRipple as PaperTouchableRipple } from 'react-native-paper';

export type TouchableRippleProps = React.ComponentProps<typeof PaperTouchableRipple> & {
  rippleColor?: string;
  underlayColor?: string;
};

export const TouchableRipple = (props: TouchableRippleProps) => {
  return <PaperTouchableRipple {...props} />;
};

export default TouchableRipple;
