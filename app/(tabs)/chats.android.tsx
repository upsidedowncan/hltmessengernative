import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, { 
  FadeInUp, 
  FadeOutUp, 
  Layout, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '@/contexts/theme-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, IconButton, FAB, Text as RNPText, Divider, Chip, Surface } from 'react-native-paper';
import { TouchableRipple } from '@/components/touchable-ripple';

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

const AvatarComponent = ({ name, avatarUrl, backgroundColor, m3 }: { name: string; avatarUrl?: string | null; backgroundColor: string; m3: any }) => {
  const initials = name ? name.substring(0, 1).toUpperCase() : 'U';
  
  return (
    <View style={[styles.avatar, { backgroundColor: backgroundColor || m3.primaryContainer }]}>
      <RNPText style={[styles.avatarText, { color: m3.onPrimaryContainer }]}>{initials}</RNPText>
    </View>
  );
};

const LockedAvatarComponent = ({ m3 }: { m3: any }) => {
  return (
    <View style={[styles.avatar, { backgroundColor: m3.secondaryContainer }]}>
      <MaterialCommunityIcons name="lock" size={24} color={m3.primary} />
    </View>
  );
};

export default function ChatScreen() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

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
    return (
      <View style={{ backgroundColor: m3.background }}>
        {!showLockedChats ? (
          <TouchableRipple 
            onPress={handleShowLockedChats}
            rippleColor={m3.primary + '30'}
          >
            <View style={styles.lockRow}>
              <View style={styles.lockRowContent}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={m3.primary} />
                <RNPText variant="bodyMedium" style={{ color: m3.onSurface, flex: 1, fontWeight: '500' }}>
                  Locked Chats
                </RNPText>
                <MaterialCommunityIcons name="chevron-right" size={20} color={m3.onSurfaceVariant} />
              </View>
            </View>
          </TouchableRipple>
        ) : (
          <Animated.View 
            entering={FadeInUp.springify()} 
            layout={Layout.springify()}
            style={[styles.lockedSection, { borderBottomWidth: 1, borderBottomColor: m3.outlineVariant }]}
          >
            <View style={styles.lockedHeader}>
              <MaterialCommunityIcons name="lock-open-outline" size={20} color={m3.primary} />
              <RNPText variant="labelMedium" style={{ color: m3.primary, fontWeight: '700', letterSpacing: 0.5 }}>
                LOCKED CHATS
              </RNPText>
              <View style={{ flex: 1 }} />
              <IconButton 
                icon="close-circle-outline" 
                size={20} 
                onPress={() => setShowLockedChats(false)} 
                iconColor={m3.onSurfaceVariant}
              />
            </View>
            {lockedChats.map((item) => (
              <Animated.View key={item.friend_id} entering={FadeInUp.delay(50)}>
                <TouchableRipple 
                  onPress={() => openLockedChat(item)}
                  rippleColor={m3.primary + '30'}
                >
                  <View style={[styles.chatContent, { paddingVertical: 8 }]}>
                    <LockedAvatarComponent m3={m3} />
                    <View style={styles.textContainer}>
                      <RNPText variant="titleMedium" style={{ color: m3.onSurface, fontSize: 15 }}>
                        {item.full_name || item.username}
                      </RNPText>
                      <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
                        Tap to unlock conversation
                      </RNPText>
                    </View>
                  </View>
                </TouchableRipple>
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.background }} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.Content title="Chats" titleStyle={{ color: m3.onSurface }} />
        <Appbar.Action icon="dots-vertical" onPress={() => {}} color={m3.onSurface} />
      </Appbar.Header>

      <FlatList
        data={filteredChats}
        keyExtractor={item => item.friend_id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchChats(); }}
            tintColor={m3.primary}
            colors={[m3.primary]}
          />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={() =>
          !loading && filteredChats.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <IconButton icon="chatbubbles-outline" size={64} iconColor={m3.onSurfaceVariant} />
              <RNPText variant="bodyLarge" style={{ color: m3.onSurfaceVariant, marginTop: 16 }}>No recent chats</RNPText>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableRipple 
            onPress={() => openChat(item)}
            rippleColor={m3.primary + '30'}
            style={{ backgroundColor: m3.background }}
          >
            <View>
              <View style={styles.chatContent}>
                <AvatarComponent 
                  name={item.full_name || item.username} 
                  backgroundColor={m3.primaryContainer} 
                  m3={m3} 
                />

                <View style={styles.textContainer}>
                  <View style={styles.headerRow}>
                    <RNPText variant="titleMedium" style={{ color: m3.onSurface, flex: 1, fontWeight: '700' }}>
                      {item.full_name || item.username}
                    </RNPText>
                    <RNPText variant="bodySmall" style={{ color: item.unread_count > 0 ? m3.primary : m3.onSurfaceVariant, fontWeight: item.unread_count > 0 ? '700' : '400' }}>
                      {formatTime(item.last_message_at)}
                    </RNPText>
                  </View>

                  <View style={styles.messageRow}>
                    <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {item.last_message}
                    </RNPText>
                    {item.unread_count > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: m3.primary }]}>
                        <RNPText style={styles.unreadText}>{item.unread_count}</RNPText>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <Divider style={{ backgroundColor: m3.outlineVariant, marginLeft: 84 }} />
            </View>
          </TouchableRipple>
        )}
      />

      <FAB
        icon="message-plus"
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        color={m3.primary}
        onPress={() => router.push('/search')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 0,
  },
  chatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 16,
    elevation: 4,
  },
  lockRow: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  lockRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  lockedSection: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingBottom: 8,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
