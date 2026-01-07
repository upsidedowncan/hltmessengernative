import React, { useLayoutEffect } from 'react';
import {
  View,
  Platform,
  TextStyle,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
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
  const { theme } = useAppTheme();
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
    <View style={[
      styles.customHeader, 
      { 
        backgroundColor: backgroundColor || theme.background,
        paddingTop: insets.top,
        borderBottomWidth: showBorder ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: theme.border
      }
    ]}>
      <View style={styles.headerContent}>
         <View style={styles.leftAction}>
            {showBackButton && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                 <Ionicons 
                    name={Platform.OS === 'ios' ? "chevron-back" : "arrow-back"} 
                    size={28} 
                    color={activeTintColor} 
                 />
              </TouchableOpacity>
            )}
            {leftComponent}
         </View>
         
         <View style={styles.centerAction}>
            {centerComponent || (
              <Text style={[styles.titleText, { color: theme.text }, titleStyle]}>
                {title}
              </Text>
            )}
         </View>
         
         <View style={styles.rightAction}>
            {rightComponent}
         </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  leftAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  customHeader: {
    width: '100%',
  },
  headerContent: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
