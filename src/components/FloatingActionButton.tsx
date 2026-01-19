import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  color?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  onPress, 
  icon = "add", 
  style,
  color 
}) => {
  const { theme } = useTheme();
  const fabColor = color || theme.tint;

  return (
    <View style={[styles.container, style]} pointerEvents="box-none">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          styles.button, 
          { backgroundColor: fabColor },
          Platform.select({
            ios: styles.shadowIOS,
            android: styles.shadowAndroid
          })
        ]}
      >
        <Ionicons name={icon} size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 999,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shadowIOS: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  shadowAndroid: {
    elevation: 8,
  },
});
