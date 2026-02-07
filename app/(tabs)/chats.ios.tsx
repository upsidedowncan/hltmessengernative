import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert } from 'react-native';
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

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

  const renderLockedChatsSection = () => {
    if (lockedChats.length === 0) return null;

    if (showLockedChats && lockedChats.length > 0) {
      return (
        <Animated.View 
          layout={Layout.springify().damping(20).stiffness(90)}
          entering={FadeInUp.duration(400)}
          style={styles.lockedSection}
        >
          <TouchableOpacity 
            style={[styles.lockedHeader, { borderBottomColor: theme.border }]}
            onPress={() => setShowLockedChats(false)}
            activeOpacity={0.7}
          >
            <View style={[styles.lockedIconCircle, { backgroundColor: theme.tint + '15' }]}>
              <Ionicons name="lock-closed" size={16} color={theme.tint} />
            </View>
            <Text style={[styles.lockedHeaderText, { color: theme.tint }]}>Locked Chats</Text>
            <Ionicons name="chevron-up" size={14} color={theme.tint} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {lockedChats.map((item) => (
            <TouchableOpacity 
              key={item.friend_id}
              style={[styles.itemContainer, { backgroundColor: theme.background }]}
              activeOpacity={0.7}
              onPress={() => openLockedChat(item)}
            >
              <Avatar name={item.full_name || item.username} backgroundColor={theme.tint} />
              <View style={[styles.textContainer, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingBottom: 12 }]}>
                <View style={styles.headerRow}>
                  <Text style={[styles.name, { color: theme.text, fontWeight: '700' }]}>
                    {item.full_name || item.username}
                  </Text>
                </View>
                <Text style={[styles.lockedSubtext, { color: theme.tabIconDefault }]}>
                  Locked chat
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.slimLockRow}
        activeOpacity={0.7}
        onPress={handleShowLockedChats}
      >
        <View style={styles.slimLockLeft}>
          <Ionicons name="lock-closed" size={20} color={theme.tint} />
          <Text style={[styles.slimLockText, { color: theme.text }]}>Locked Chats</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.tabIconDefault} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    );
  };

  const renderChatItem = (item: ChatPreview) => {
    return (
      <TouchableOpacity key={item.friend_id} onPress={() => openChat(item)} activeOpacity={0.7}>
        <View style={styles.itemContainer}>
          <Avatar name={item.full_name || item.username} backgroundColor={theme.tint} />
          <View style={[styles.textContainer, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingBottom: 12 }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.name, { color: theme.text, fontWeight: '700' }]}>
                {item.full_name || item.username}
              </Text>
              <Text style={[styles.time, { color: item.unread_count > 0 ? theme.tint : theme.tabIconDefault }]}>
                {formatTime(item.last_message_at)}
              </Text>
            </View>
            <View style={styles.messageRow}>
              <Text
                numberOfLines={2}
                style={[
                  styles.message,
                  {
                    flex: 1,
                    fontWeight: item.unread_count > 0 ? '500' : '400',
                    color: theme.tabIconDefault
                  }
                ]}
              >
                {item.last_message}
              </Text>
              {item.unread_count > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.tint }]}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'right', 'left']}>
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchChats(); }}
            tintColor={theme.tint}
          />
        }
      >
        {renderLockedChatsSection()}
        
        {!loading && chats.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 100, opacity: 0.5 }}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.text} />
            <Text style={{ color: theme.text, marginTop: 16 }}>No recent chats</Text>
          </View>
        )}
        
        {isLiquidGlassSupported ? (
          <LiquidGlassContainerView spacing={0}>
            {chats.map((item) => renderChatItem(item))}
          </LiquidGlassContainerView>
        ) : (
          <View style={styles.fallbackContainer}>
            {chats.map((item) => renderChatItem(item))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    paddingLeft: 16,
    paddingTop: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    paddingRight: 16,
    justifyContent: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 17,
    letterSpacing: -0.4,
  },
  time: {
    fontSize: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  message: {
    fontSize: 15,
    lineHeight: 20,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
    marginTop: 2,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  slimLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  slimLockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slimLockText: {
    fontSize: 17,
    fontWeight: '600',
  },
  lockedSection: {
    marginBottom: 8,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  lockedIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedHeaderText: {
    fontSize: 15,
    fontWeight: '600',
  },
  lockedSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
});
