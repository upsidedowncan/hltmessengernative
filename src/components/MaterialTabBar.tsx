import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appbar } from 'react-native-paper';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue, 
  interpolate, 
  interpolateColor 
} from 'react-native-reanimated';

interface MaterialTabBarProps {
  state?: any;
  descriptors?: any;
  navigation?: any;
  position?: any;
  // Fallback props
  title?: string;
  children?: React.ReactNode;
}

const TabItem = ({ 
  route, 
  index, 
  state, 
  descriptors, 
  navigation, 
  theme 
}: any) => {
  const isFocused = state.index === index;
  const { options } = descriptors[route.key];
  const label = options.tabBarLabel ?? options.title ?? route.name;

  const onPress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const onLongPress = () => {
    navigation.emit({
      type: 'tabLongPress',
      target: route.key,
    });
  };

  // Animation for the pill background
  const animation = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    animation.value = withSpring(isFocused ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [isFocused]);

  const rPillStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
    transform: [{ scale: animation.value }],
    backgroundColor: theme.tint + '20', // 20% opacity tint
  }));

  const rTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animation.value, [0, 1], [0.7, 1]),
    transform: [{ scale: interpolate(animation.value, [0, 1], [0.9, 1]) }],
    color: interpolateColor(
      animation.value,
      [0, 1],
      [theme.tabIconDefault, theme.tint]
    ),
  }));

  const renderIcon = () => {
    const color = isFocused ? theme.tint : theme.tabIconDefault;
    
    if (options.tabBarIcon) {
      return options.tabBarIcon({ focused: isFocused, color, size: 24 });
    }

    const name = route.name.toLowerCase();
    let iconName = 'ellipse-outline';
    
    if (name.includes('chat')) iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
    else if (name.includes('call')) iconName = isFocused ? 'call' : 'call-outline';
    else if (name.includes('people') || name.includes('friend')) iconName = isFocused ? 'people' : 'people-outline';
    else if (name.includes('setting')) iconName = isFocused ? 'settings' : 'settings-outline';
    else if (name === 'ai') iconName = isFocused ? 'sparkles' : 'sparkles-outline';
    else if (name.includes('profile')) iconName = isFocused ? 'person-circle' : 'person-circle-outline';
    
    return <Ionicons name={iconName as any} size={24} color={color} />;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, rPillStyle]} />
        {renderIcon()}
      </View>
      <Animated.Text style={[styles.label, rTextStyle]}>
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
};

export const MaterialTabBar: React.FC<MaterialTabBarProps> = ({
  state,
  descriptors,
  navigation,
  title,
  children,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Check if this is being used as a Tab Bar
  const isTabBar = state && state.routes && Array.isArray(state.routes);

  if (isTabBar) {
    return (
      <View style={[
        styles.container, 
        { 
          backgroundColor: theme.cardBackground,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        }
      ]}>
        {state.routes.map((route: any, index: number) => (
          <TabItem
            key={route.key}
            route={route}
            index={index}
            state={state}
            descriptors={descriptors}
            navigation={navigation}
            theme={theme}
          />
        ))}
      </View>
    );
  }

  // Fallback to Appbar for header usage
  return (
    <Appbar.Header style={{ backgroundColor: theme.background }} elevated>
      <Appbar.Content title={title} titleStyle={{ color: theme.text, fontWeight: '600' }} />
      {children}
    </Appbar.Header>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  iconWrapper: {
    width: 50,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pill: {
    borderRadius: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
