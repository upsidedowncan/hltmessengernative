import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../context/FeatureFlagContext';
import { MainStackParamList } from '../navigation/MainNavigator';
import { Button, Tile, ProfileHeader, AppBar } from '../components';
import { useAuth } from '../context/AuthContext';
import { NotificationSetup } from '../components/NotificationSetup';
import { supabase } from '../services/supabase';

export const SettingsScreen = () => {
  const { theme } = useAppTheme();
  const { signOut, profile, refreshProfile, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (profile) {
      if (firstLoad.current) {
        setUsername(profile.username || '');
        setFullName(profile.full_name || '');
        firstLoad.current = false;
      }
    }
  }, [profile]);

  const handleAutoSave = (newUsername: string, newFullName: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!user) return;
    if (newUsername.length < 3) return; 

    setIsSaving(true);
    typingTimeoutRef.current = setTimeout(async () => {
      try {
         const { error } = await supabase.rpc('upsert_profile', {
            new_username: newUsername,
            new_full_name: newFullName,
            new_avatar_url: profile?.avatar_url || null
          });

          if (!error) {
             await refreshProfile();
          }
      } catch (e) {
        console.log("Auto-save failed", e);
      } finally {
        setIsSaving(false);
      }
    }, 1000); 
  };

  const onUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    handleAutoSave(cleaned, fullName);
  };

  const onFullNameChange = (text: string) => {
    setFullName(text);
    handleAutoSave(username, text);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic">
      <AppBar title="Settings" isNative={true} largeTitle={true} />

      <ProfileHeader 
        fullName={fullName}
        username={username}
        isSaving={isSaving}
        onFullNameChange={onFullNameChange}
        onUsernameChange={onUsernameChange}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>General</Text>
        <Tile
          title="Notifications"
          icon="notifications-outline"
          onPress={() => {}}
        />
        <View style={{ paddingHorizontal: 24 }}>
          <NotificationSetup />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Developer</Text>
        <View style={styles.groupContainer}>
          <Tile
            title="Component Lab"
            icon="beaker-outline"
            onPress={() => navigation.navigate('ComponentTest')}
            groupPosition="top"
          />
          <Tile
            title="Developer Settings"
            icon="code-slash-outline"
            onPress={() => navigation.navigate('DevSettings')}
            groupPosition="bottom"
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={{ paddingHorizontal: 24 }}>
          <Button
            title="Sign Out"
            onPress={signOut}
            type="outline"
            color="#ef5350"
            textColor="#ef5350"
            icon="log-out-outline"
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
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
  section: {
    marginTop: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  groupContainer: {
    gap: 0,
  },
});

