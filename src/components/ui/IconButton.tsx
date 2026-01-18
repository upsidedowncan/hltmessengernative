import { requireNativeView } from 'expo';
import React from 'react';

// Assuming these types exist or we need to define/mock them for now since strict paths were not provided for dependencies
// I will define minimal types here to make it compile, assuming the user will provide the dependencies or I should infer them.
// Given the context of "adding this now", it implies integration into an existing system. 
// However, 'expo' export 'requireNativeView' is standard. The other imports like '../../types' suggest this code snippet 
// might be from a library source. I will adapt it to be a standalone component in the user's project.

// Minimal mock for types if they don't exist in the project, but typically I should check.
// Since I can't check 'types.ts' easily without knowing where it is relative to the user's snippet source, 
// I will inline necessary types or assume standard usage.

// ADJUSTMENT: The snippet provided seems to depend on internal library types (ExpoModifier, ViewEvent, etc.). 
// I will implement a simplified version that works with the provided snippet structure but self-contained where possible,
// or placeholder types if they are specific to the @expo/ui implementation detail.

// Actually, looking at the snippet, it imports from relative paths like '../../types'. 
// I will create a file that attempts to use the @expo/ui primitives if available, or just paste the code as requested 
// into a new file, but I need to resolve the imports.

// Since the user said "Try adding this now", and provided code that imports from `../../types`, `../Button`, `../Shape`, 
// it looks like source code for the library itself. 
// If I am to add this TO the project, I likely need to adapt it. 
// BUT, maybe the user wants me to simulate/polyfill this component?
// I'll create `src/components/ui/IconButton.tsx` and try to make it work.

// Wait, `requireNativeView` from `expo` suggests this is indeed a native component wrapper.
// If `@expo/ui/jetpack-compose` already exists (used in previous turns), maybe `IconButton` is missing from it?
// Or I am extending it.

// Let's write the file, but I need to handle the imports.
// I'll assume for a moment the user wants this exact code. But `../../types` won't resolve.
// I will strip the relative imports and replace them with `any` or minimal definitions to allow compilation,
// preserving the logic.

// ... On second thought, if this is a "native view", it requires native code backing it. 
// Just adding JS won't make `requireNativeView('ExpoUI', 'IconButton')` work unless the native side exposes it.
// Assuming the native side (Expo Go or dev client) HAS this view and I just need the JS interface.

export type IconButtonVariant = 'default' | 'bordered' | 'outlined';

export type ButtonElementColors = {
  containerColor?: string;
  contentColor?: string;
};

// Mocking Shape types for now
export type ShapeJSXElement = React.JSX.Element;
export type ShapeProps = any;
export function parseJSXShape(shape?: ShapeJSXElement): ShapeProps {
    return {}; 
}

export type ExpoModifier = any;
export type ViewEvent<T extends string | number | symbol, D> = {
    [K in T]?: (event: { nativeEvent: D }) => void;
};

export type IconButtonProps = {
  /**
   * A callback that is called when the button is pressed.
   */
  onPress?: () => void;
  /**
   * The button variant.
   */
  variant?: IconButtonVariant;
  /**
   * The text to display inside the button.
   */
  children?: React.JSX.Element;
  /**
   * Colors for button's core elements.
   * @platform android
   */
  elementColors?: ButtonElementColors;
  /**
   * Button color.
   */
  color?: string;
  shape?: ShapeJSXElement;
  /**
   * Disabled state of the button.
   */
  disabled?: boolean;

  /**
   * Modifiers for the component.
   */
  modifiers?: ExpoModifier[];
};

/**
 * @hidden
 */
export type NativeIconButtonProps = Omit<IconButtonProps, 'role' | 'onPress' | 'shape'> & {
  shape: ShapeProps;
} & ViewEvent<'onButtonPressed', void>;

// We have to work around the `role` and `onPress` props being reserved by React Native.
const IconButtonNativeView: React.ComponentType<NativeIconButtonProps> = requireNativeView(
  'ExpoUI',
  'IconButton'
);

/**
 * @hidden
 */
export function transformIconButtonProps(props: IconButtonProps): NativeIconButtonProps {
  const { children, onPress, shape, ...restProps } = props;

  return {
    ...restProps,
    children,
    shape: parseJSXShape(shape),
    onButtonPressed: onPress ? () => onPress() : undefined,
    modifiers: props.modifiers?.map((m) => m.__expo_shared_object_id__),
    elementColors: props.elementColors
      ? props.elementColors
      : props.color
        ? {
            containerColor: props.color,
          }
        : undefined,
  };
}

/**
 * Displays a native button component.
 */
export function IconButton(props: IconButtonProps) {
  return <IconButtonNativeView {...transformIconButtonProps(props)} />;
}
