import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { TextField } from './TextField';
import Animated, { FadeIn, FadeOut, Layout, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface ProfileHeaderProps {
  fullName: string;
  username: string;
  isSaving?: boolean;
  onFullNameChange: (text: string) => void;
  onUsernameChange: (text: string) => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  fullName,
  username,
  isSaving,
  onFullNameChange,
  onUsernameChange
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const toggleExpand = () => {
    setExpanded(!expanded);
    rotation.value = withTiming(expanded ? 0 : 180, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const getInitials = () => {
    if (fullName) return fullName.substring(0, 2).toUpperCase();
    if (username) return username.substring(0, 2).toUpperCase();
    return '??';
  };

  return (
    <Animated.View layout={Layout.springify().damping(25).stiffness(200).mass(0.5)} style={{ overflow: 'hidden' }}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7}>
        <View style={[styles.profileHeader, expanded && { borderBottomWidth: 0 }]}>
          <View style={[styles.avatarContainer, { backgroundColor: (theme as any).secondaryContainer || theme.border, borderColor: theme.tint }]}>
            <Text style={[styles.avatarText, { color: (theme as any).onSecondaryContainer || theme.text }]}>{getInitials()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: theme.text }]}>{fullName || 'User'}</Text>
            <Text style={[styles.profileHandle, { color: theme.tabIconDefault }]}>@{username || 'username'}</Text>
          </View>
          {isSaving && <ActivityIndicator size="small" color={theme.tint} style={{ marginRight: 8 }} />}
          <Animated.View style={[{ marginLeft: 8 }, animatedStyle]}>
              <Ionicons name="chevron-down" size={20} color={theme.tabIconDefault} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View 
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={styles.editSection}
        >
           <TextField
              label="Display Name"
              value={fullName}
              onChangeText={onFullNameChange}
              placeholder="Your Name"
              leftIcon="person-outline"
              groupPosition="top"
            />
            <TextField
              label="Username"
              value={username}
              onChangeText={onUsernameChange}
              placeholder="username"
              autoCapitalize="none"
              leftIcon="at-outline"
              groupPosition="bottom"
            />
             <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 8, marginLeft: 4 }}>
                Changes are saved automatically.
             </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
  },
  profileHandle: {
    fontSize: 16,
    color: '#888',
  },
  editSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 0, 
  },
});
