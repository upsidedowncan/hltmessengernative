import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

type ChatPreview = {
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

const Avatar = ({ name }: { name: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <View style={styles.avatar}>
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchChats(); }}
            tintColor={theme.tint}
          />
        }
      >
        {!loading && chats.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 100, opacity: 0.5 }}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.text} />
            <Text style={{ color: theme.text, marginTop: 16 }}>No recent chats</Text>
          </View>
        )}
        
        <LiquidGlassContainerView spacing={0}>
          {chats.map((item) => (
            <TouchableOpacity key={item.friend_id} onPress={() => openChat(item)} activeOpacity={0.7}>
              <LiquidGlassView
                style={styles.itemContainer}
                interactive
                effect="clear"
              >
                <Avatar name={item.full_name || item.username} />
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
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.message,
                        {
                          flex: 1,
                          fontWeight: item.unread_count > 0 ? '600' : '400',
                          color: item.unread_count > 0 ? theme.text : theme.tabIconDefault
                        }
                      ]}
                    >
                      {item.last_message}
                    </Text>
                    {item.unread_count > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: '#FF3B30' }]}>
                        <Text style={styles.unreadText}>{item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </LiquidGlassView>
            </TouchableOpacity>
          ))}
        </LiquidGlassContainerView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 60,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    // Removed solid background
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
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
    fontWeight: '600',
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
});