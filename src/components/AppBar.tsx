import React, { useLayoutEffect } from 'react';
import { View, Platform, TextStyle, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AppBarProps {
  title?: string;
  centerComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  leftComponent?: React.ReactNode;
  
  // Back Button Customization
  showBackButton?: boolean;
  backTitle?: string;
  backTitleVisible?: boolean;
  
  // Styling
  tintColor?: string;
  backgroundColor?: string;
  transparent?: boolean;
  showBorder?: boolean;
  titleStyle?: TextStyle;
  
  // iOS Specific
  largeTitle?: boolean;

  /** 
   * If true, configures the native navigator header. 
   * If false, renders a visual header component.
   */
  isNative?: boolean;
}

export const AppBar: React.FC<AppBarProps> = ({
  title,
  centerComponent,
  rightComponent,
  leftComponent,
  showBackButton = true,
  backTitle = "",
  backTitleVisible = false,
  tintColor,
  backgroundColor,
  transparent = false,
  showBorder = true,
  titleStyle,
  largeTitle = false,
  isNative = true,
}) => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const activeTintColor = tintColor || theme.tint;

  useLayoutEffect(() => {
    if (!isNative) {
      navigation.setOptions({ headerShown: false });
      return;
    }

    navigation.setOptions({
      headerShown: true,
      title: title,
      headerTitle: centerComponent ? () => centerComponent : title,
      headerRight: rightComponent ? () => <View style={styles.rightAction}>{rightComponent}</View> : undefined,
      
      // TRULY NATIVE BACK BUTTON
      headerBackVisible: showBackButton,
      headerBackTitle: backTitleVisible ? backTitle : "", // Empty string is the standard way to hide it
      headerBackTitleVisible: backTitleVisible,
      
      headerLeft: leftComponent ? () => <View style={styles.leftAction}>{leftComponent}</View> : undefined,
      
      headerTintColor: activeTintColor,
      headerTransparent: transparent,
      headerStyle: {
        backgroundColor: backgroundColor || (transparent ? 'transparent' : theme.background),
      },
      headerTitleStyle: {
        color: theme.text,
        fontSize: 18,
        fontWeight: Platform.OS === 'ios' ? '600' : '700',
        ...titleStyle,
      },
      headerShadowVisible: showBorder,
      elevation: showBorder ? undefined : 0,
      headerLargeTitle: largeTitle,
    });
  }, [
    isNative,
    navigation, 
    title, 
    centerComponent, 
    rightComponent, 
    leftComponent, 
    showBackButton, 
    backTitle,
    backTitleVisible,
    activeTintColor, 
    backgroundColor, 
    transparent, 
    showBorder, 
    titleStyle, 
    largeTitle, 
    theme
  ]);

  if (isNative) return null;

  return (
    <Appbar.Header
      mode={largeTitle ? 'large' : 'center-aligned'}
      elevated={showBorder}
      style={{ backgroundColor: backgroundColor || theme.background }}
    >
      {showBackButton && <Appbar.BackAction onPress={() => navigation.goBack()} color={activeTintColor} />}
      {leftComponent}
      
      <Appbar.Content 
        title={centerComponent || title} 
        titleStyle={[{ color: theme.text }, titleStyle]}
        color={theme.text}
      />

      {rightComponent}
    </Appbar.Header>
  );
};

const styles = StyleSheet.create({
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
