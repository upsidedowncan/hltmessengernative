import React from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export interface ToolbarItem {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isActive?: boolean;
  color?: string; // Custom color override
  backgroundColor?: string; // Custom bg override
  label?: string; // Optional text label
}

interface ToolbarProps {
  items: ToolbarItem[];
  style?: StyleProp<ViewStyle>;
  transparent?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ items, style, transparent = false }) => {
  const isIOS = Platform.OS === 'ios';

  const Container = isIOS && !transparent ? BlurView : View;
  const containerProps = isIOS && !transparent ? { intensity: 80, tint: 'dark' } : {};

  return (
    <Container 
      style={[
        styles.container, 
        isIOS ? styles.iosContainer : styles.androidContainer,
        transparent && styles.transparentContainer,
        style
      ]} 
      {...containerProps}
    >
      {items.map((item, index) => (
        <View key={index} style={styles.itemWrapper}>
          <TouchableOpacity
            style={[
              styles.button,
              { 
                backgroundColor: item.backgroundColor || (item.isActive ? '#fff' : 'rgba(255,255,255,0.15)') 
              }
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={item.icon} 
              size={28} 
              color={item.color || (item.isActive ? '#000' : '#fff')} 
            />
          </TouchableOpacity>
          {item.label && <Text style={styles.label}>{item.label}</Text>}
        </View>
      ))}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
  },
  iosContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  androidContainer: {
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
  },
  transparentContainer: {
    backgroundColor: 'transparent',
  },
  itemWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});