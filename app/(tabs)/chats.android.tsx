import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '../../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, IconButton, FAB, Text as RNPText, Divider, Chip, TouchableRipple } from 'react-native-paper';

type ChatPreview = {
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

const AvatarComponent = ({ name, backgroundColor }: { name: string; backgroundColor: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      <RNPText style={styles.avatarText}>{initials}</RNPText>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.background }} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.Content title="Chats" titleStyle={{ color: m3.onSurface }} />
        <Appbar.Action icon="dots-vertical" onPress={() => {}} color={m3.onSurface} />
      </Appbar.Header>

      <FlatList
        data={chats}
        keyExtractor={item => item.friend_id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchChats(); }}
            tintColor={m3.primary}
            colors={[m3.primary]}
          />
        }
        ListEmptyComponent={() =>
          !loading ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <IconButton icon="chatbubbles-outline" size={64} iconColor={m3.onSurfaceVariant} />
              <RNPText variant="bodyLarge" style={{ color: m3.onSurfaceVariant, marginTop: 16 }}>No recent chats</RNPText>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <>
            <TouchableRipple onPress={() => openChat(item)} style={{ backgroundColor: m3.surface }}>
              <View style={styles.chatContent}>
                <AvatarComponent name={item.full_name || item.username} backgroundColor="#5856D6" />

                <View style={styles.textContainer}>
                  <View style={styles.headerRow}>
                    <RNPText variant="titleMedium" style={{ color: m3.onSurface, flex: 1 }}>
                      {item.full_name || item.username}
                    </RNPText>
                    <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
                      {formatTime(item.last_message_at)}
                    </RNPText>
                  </View>

                  <View style={styles.messageRow}>
                    <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant }} numberOfLines={1}>
                      {item.last_message}
                    </RNPText>
                    {item.unread_count > 0 && (
                      <Chip compact mode="flat" textStyle={{ color: '#fff', fontSize: 12, fontWeight: '600' }} style={{ backgroundColor: m3.primary, height: 24, minWidth: 24 }}>
                        {item.unread_count}
                      </Chip>
                    )}
                  </View>
                </View>
              </View>
            </TouchableRipple>
            <Divider style={{ backgroundColor: m3.outlineVariant, marginLeft: 82 }} />
          </>
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
    paddingVertical: 8,
  },
  chatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fab: {
    position: 'absolute',
    right: 16,
  }
});
