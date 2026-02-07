import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { AppBar } from '@/components/app-bar';
import { CustomBackground } from '@/components/custom-background';

type ChatPreview = {
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

type LockedChat = {
  friend_id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
};

const Avatar = ({ name, backgroundColor }: { name: string; backgroundColor: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
};

export default function ChatScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [lockedChats, setLockedChats] = useState<LockedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showLockedChats, setShowLockedChats] = useState(false);

  // Filter out locked chats from main list
  const filteredChats = useMemo(() => {
    const lockedIds = new Set(lockedChats.map(l => l.friend_id));
    return chats.filter(chat => !lockedIds.has(chat.friend_id));
  }, [chats, lockedChats]);

  const fetchChats = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_recent_chats');
      if (error) throw error;
      setChats(data || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const checkBiometric = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setBiometricAvailable(compatible);
    };
    checkBiometric();
  }, []);

  const fetchLockedChatsList = async (): Promise<LockedChat[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase.rpc('get_recent_chats');
      if (error) throw error;
      
      const locked: LockedChat[] = [];
      for (const chat of data || []) {
        const isLocked = await AsyncStorage.getItem(`locked_chat_${chat.friend_id}`);
        if (isLocked === 'true') {
          locked.push({
            friend_id: chat.friend_id,
            full_name: chat.full_name,
            username: chat.username,
            avatar_url: chat.avatar_url,
          });
        }
      }
      return locked;
    } catch (error) {
      console.error('Error fetching locked chats:', error);
      return [];
    }
  };

  const handleShowLockedChats = async () => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to view locked chats',
    });

    if (result.success) {
      const locked = await fetchLockedChatsList();
      setLockedChats(locked);
      setShowLockedChats(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [user])
  );

  const openChat = (item: ChatPreview) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: item.friend_id,
        friendId: item.friend_id,
        friendName: item.full_name || item.username,
        friendAvatar: item.avatar_url || undefined,
      }
    });
  };

  const openLockedChat = (item: LockedChat) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: item.friend_id,
        friendId: item.friend_id,
        friendName: item.full_name || item.username,
        friendAvatar: item.avatar_url || undefined,
        isLocked: 'true',
      }
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const ListHeader = () => {
    if (showLockedChats && lockedChats.length > 0) {
      return (
        <>
          <View style={styles.lockedHeaderRow}>
            <MaterialCommunityIcons name="lock" size={18} color={theme.tint} />
            <Text style={[styles.lockedHeaderText, { color: theme.tint }]}>Locked Chats</Text>
          </View>
          {lockedChats.map((item) => (
            <TouchableOpacity 
              key={item.friend_id}
              style={[styles.itemContainer, { backgroundColor: theme.background }]}
              activeOpacity={0.7}
              onPress={() => openLockedChat(item)}
            >
              <View style={[styles.lockedAvatar, { backgroundColor: '#FF9500' }]}>
                <MaterialCommunityIcons name="account" size={20} color="#fff" />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.name, { color: theme.text }]}>
                  {item.full_name || item.username}
                </Text>
                <Text style={[styles.lockedSubtext, { color: theme.tabIconDefault }]}>
                  Locked chat
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        </>
      );
    }

    if (!showLockedChats) {
      return (
        <TouchableOpacity 
          style={[styles.lockButton, { backgroundColor: theme.background }]}
          activeOpacity={0.7}
          onPress={handleShowLockedChats}
        >
          <View style={styles.lockButtonLeft}>
            <View style={[styles.lockButtonIcon, { backgroundColor: theme.tint }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#fff" />
            </View>
            <Text style={[styles.lockButtonText, { color: theme.text }]}>Locked Chats</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.tabIconDefault} />
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <CustomBackground />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} edges={['top', 'right', 'left']}>
        <AppBar title="Chats" isNative={false} showBackButton={false} />
        <FlatList
        data={filteredChats}
        keyExtractor={item => item.friend_id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChats(); }} tintColor={theme.tint} />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={() => (
           !loading && filteredChats.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100, opacity: 0.5 }}>
              <Text style={{ color: theme.text }}>No recent chats</Text>
            </View>
           ) : null
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.itemContainer} 
            activeOpacity={0.7}
            onPress={() => openChat(item)}
          >
            <Avatar name={item.full_name || item.username} backgroundColor={theme.tint} />
            <View style={styles.textContainer}>
              <View style={styles.headerRow}>
                <Text style={[styles.name, { color: theme.text }]}>
                    {item.full_name || item.username}
                </Text>
                <Text style={[styles.time, { color: theme.tabIconDefault }]}>
                    {formatTime(item.last_message_at)}
                </Text>
              </View>
              <View style={styles.messageRow}>
                 <Text numberOfLines={1} style={[styles.message, { flex: 1, fontWeight: item.unread_count > 0 ? 'bold' : 'normal', color: item.unread_count > 0 ? theme.text : theme.tabIconDefault }]}>
                  {item.last_message}
                </Text>
                {item.unread_count > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: theme.tint }]}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    fontSize: 14,
    marginRight: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 82, 
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  lockedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  lockedHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  lockedAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  lockedSubtext: {
    fontSize: 13,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 0,
    marginBottom: 10,
  },
  lockButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
