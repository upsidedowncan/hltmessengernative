import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ViewStyle,
  ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  image?: ImageSourcePropType | string;
  onPress?: () => void;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  style?: ViewStyle;
  children?: React.ReactNode;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  description,
  image,
  onPress,
  footer,
  header,
  style,
  children,
  elevated = true,
}) => {
  const { theme, isDarkMode } = useTheme();
  const isIOS = Platform.OS === 'ios';

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container 
      activeOpacity={isIOS ? 0.7 : 0.85} 
      onPress={onPress}
      style={[
        styles.container,
        isIOS ? styles.containerIOS : styles.containerAndroid,
        { 
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          borderWidth: !elevated || isIOS ? StyleSheet.hairlineWidth : 0,
        },
        elevated && (isIOS ? styles.elevatedIOS : styles.elevatedAndroid),
        style
      ]}
    >
      {header && <View style={styles.header}>{header}</View>}
      
      {image && (
        <Image 
          source={typeof image === 'string' ? { uri: image } : image} 
          style={[styles.image, isIOS && { height: 200 }]}
          contentFit="cover"
          transition={200}
        />
      )}

      {(title || subtitle || description) && (
        <View style={styles.content}>
          {subtitle && (
            <Text style={[
              styles.subtitle, 
              { color: isIOS ? theme.tabIconDefault : theme.tint },
              isIOS && { textTransform: 'none', letterSpacing: 0, fontSize: 13, fontWeight: '400' }
            ]}>
              {isIOS ? subtitle : subtitle.toUpperCase()}
            </Text>
          )}
          {title && (
            <Text style={[
              styles.title, 
              { color: theme.text },
              isIOS && { fontSize: 20, fontWeight: '600' }
            ]}>
              {title}
            </Text>
          )}
          {description && (
            <Text style={[
              styles.description, 
              { color: isIOS ? theme.text : theme.tabIconDefault },
              isIOS && { opacity: 0.7, fontSize: 15 }
            ]}>
              {description}
            </Text>
          )}
        </View>
      )}

      {children && <View style={styles.children}>{children}</View>}

      {footer && (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          {footer}
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    marginBottom: 16,
  },
  containerAndroid: {
    borderRadius: 12, // Slightly tighter radius
  },
  containerIOS: {
    borderRadius: 12,
  },
  elevatedAndroid: {
    elevation: 2, // Minimalist M2 elevation
  },
  elevatedIOS: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, // Almost invisible shadow for modern iOS look
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 180,
  },
  content: {
    padding: 16,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  children: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    padding: 12,
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
