import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { MainStackParamList } from '../navigation/MainNavigator';
import { useAppTheme } from '../context/FeatureFlagContext';
import { Button, TextField, Tile, AppBar } from '../components';

export const ProfileScreen = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long.');
      return;
    }
    if (!fullName) {
      Alert.alert('Error', 'Display Name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.rpc('upsert_profile', {
        new_username: username,
        new_full_name: fullName,
        new_avatar_url: profile?.avatar_url || null
      });

      if (error) {
        if (error.message.includes('unique constraint')) {
            throw new Error('Username already taken.');
        }
        throw error;
      }

      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    }
    finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
      if (fullName) return fullName.substring(0, 2).toUpperCase();
      if (username) return username.substring(0, 2).toUpperCase();
      return '??';
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBar title="Profile" isNative={false} showBackButton={false} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <View style={[styles.avatarContainer, { backgroundColor: (theme as any).secondaryContainer || theme.border, borderColor: theme.tint }]}>
                <Text style={[styles.avatarText, { color: (theme as any).onSecondaryContainer || theme.text }]}>{getInitials()}</Text>
            </View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{fullName || 'User Profile'}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>@{username || 'username'}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.groupContainer}>
            <TextField
              label="Display Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your Name"
              leftIcon="person-outline"
              groupPosition="top"
            />
            <TextField
              label="Username"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              autoCapitalize="none"
              leftIcon="at-outline"
              groupPosition="bottom"
            />
          </View>
          
          <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: -8, marginBottom: 8, marginLeft: 4 }}>
            Unique identifier for friends to find you.
          </Text>

          <Button 
            title="Update Profile" 
            onPress={handleUpdateProfile} 
            loading={loading}
            style={{ marginTop: 10 }}
          />

          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <Tile 
            title="Settings" 
            icon="cog-outline" 
            onPress={() => navigation.navigate('Settings')} 
          />

          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 100,
  },
  header: {
      alignItems: 'center',
      marginBottom: 32,
  },
  avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 2,
  },
  avatarText: {
      fontSize: 36,
      fontWeight: 'bold',
  },
  headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
  },
  headerSubtitle: {
      fontSize: 16,
      letterSpacing: 0.2,
  },
  form: {
    gap: 16,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  separator: {
      height: 1,
      width: '100%',
      marginVertical: 12,
      opacity: 0.5,
  },
});
