import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/services/supabase';
import { AIService, AIConversation } from '../../../src/services/AIService';
import { useTheme } from '../../../src/context/ThemeContext';
import { useAuth } from '../../../src/context/AuthContext';

// Types
type ChatPreview = {
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

type Friendship = {
  id: string;
  friend_id: string;
  friend_profile?: Profile;
};

type SectionData = {
  title: string;
  data: any[];
  type: 'chat' | 'ai' | 'friend';
};

const Avatar = ({ name }: { name: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <View style={[styles.avatar, { backgroundColor: '#333' }]}>
      <Text style={[styles.avatarText, { color: '#fff' }]}>{initials}</Text>
    </View>
  );
};

export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [aiChats, setAiChats] = useState<AIConversation[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch Chats
      const { data: chatsData } = await supabase.rpc('get_recent_chats');
      if (chatsData) setChats(chatsData);

      // Fetch AI Chats
      const aiData = await AIService.getConversations();
      setAiChats(aiData);

      // Fetch Friends
      const { data: friendsData } = await supabase.rpc('get_friends');
      if (friendsData) {
        const mappedFriends: Friendship[] = friendsData.map((f: any) => ({
          id: f.friendship_id,
          friend_id: f.friend_id,
          friend_profile: {
            id: f.friend_id,
            username: f.username,
            full_name: f.full_name,
            avatar_url: f.avatar_url
          }
        }));
        setFriends(mappedFriends);
      }

    } catch (error) {
      console.error('Error fetching search data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Search chats, people, AI...',
        onChangeText: (event: any) => setSearchQuery(event.nativeEvent.text),
        hideWhenScrolling: false,
        textColor: theme.text,
        hintTextColor: theme.tabIconDefault,
        headerIconColor: theme.text,
      },
    });
  }, [navigation, theme]);

  const getFilteredSections = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    const filteredChats = chats.filter(c => 
      c.full_name?.toLowerCase().includes(query) || 
      c.username?.toLowerCase().includes(query) ||
      c.last_message?.toLowerCase().includes(query)
    );

    const filteredAI = aiChats.filter(c => 
      c.title.toLowerCase().includes(query) || 
      c.preview?.toLowerCase().includes(query)
    );

    const filteredFriends = friends.filter(f => 
      f.friend_profile?.full_name?.toLowerCase().includes(query) || 
      f.friend_profile?.username?.toLowerCase().includes(query)
    );

    const sections: SectionData[] = [];
    
    if (filteredFriends.length > 0) {
      sections.push({ title: 'Friends', data: filteredFriends, type: 'friend' });
    }
    if (filteredChats.length > 0) {
      sections.push({ title: 'Chats', data: filteredChats, type: 'chat' });
    }
    if (filteredAI.length > 0) {
      sections.push({ title: 'AI Chats', data: filteredAI, type: 'ai' });
    }

    return sections;
  };

  const renderItem = ({ item, section }: { item: any, section: SectionData }) => {
    if (section.type === 'friend') {
      const friend = item as Friendship;
      return (
        <TouchableOpacity 
          style={styles.itemContainer} 
          onPress={() => router.push({
            pathname: '/chat/[id]',
            params: {
              id: friend.friend_id,
              friendId: friend.friend_id,
              friendName: friend.friend_profile?.full_name || friend.friend_profile?.username,
              friendAvatar: friend.friend_profile?.avatar_url || undefined,
            }
          })}
        >
          <Avatar name={friend.friend_profile?.full_name || friend.friend_profile?.username || '?'} />
          <View style={styles.textContainer}>
            <Text style={[styles.name, { color: theme.text }]}>{friend.friend_profile?.full_name}</Text>
            <Text style={[styles.subtext, { color: theme.tabIconDefault }]}>@{friend.friend_profile?.username}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (section.type === 'chat') {
      const chat = item as ChatPreview;
      return (
        <TouchableOpacity 
          style={styles.itemContainer}
          onPress={() => router.push({
            pathname: '/chat/[id]',
            params: {
              id: chat.friend_id,
              friendId: chat.friend_id,
              friendName: chat.full_name || chat.username,
              friendAvatar: chat.avatar_url || undefined,
            }
          })}
        >
          <Avatar name={chat.full_name || chat.username} />
          <View style={styles.textContainer}>
            <Text style={[styles.name, { color: theme.text }]}>{chat.full_name || chat.username}</Text>
            <Text numberOfLines={1} style={[styles.subtext, { color: theme.tabIconDefault }]}>
              {chat.last_message}
            </Text>
          </View>
          <Text style={[styles.time, { color: theme.tabIconDefault }]}>
             {new Date(chat.last_message_at).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      );
    }

    if (section.type === 'ai') {
      const ai = item as AIConversation;
      return (
        <TouchableOpacity 
          style={styles.itemContainer}
          onPress={() => router.push({
            pathname: '/ai-chat/[id]',
            params: { id: ai.id, conversationId: ai.id }
          })}
        >
           <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
              <Ionicons name="sparkles" size={24} color="#fff" />
           </View>
          <View style={styles.textContainer}>
            <Text style={[styles.name, { color: theme.text }]}>{ai.title}</Text>
            <Text numberOfLines={1} style={[styles.subtext, { color: theme.tabIconDefault }]}>
              {ai.preview || 'No messages'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const sections = getFilteredSections();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading && !searchQuery ? (
         <View style={styles.center}>
             <ActivityIndicator size="large" color={theme.tint} />
         </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
              <Text style={[styles.sectionHeaderText, { color: theme.tint }]}>{title}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.center}>
                <Text style={{ color: theme.tabIconDefault }}>No results found</Text>
              </View>
            ) : (
              <View style={styles.center}>
                <Ionicons name="search-outline" size={64} color={theme.tabIconDefault} style={{ opacity: 0.5 }} />
                <Text style={{ color: theme.tabIconDefault, marginTop: 16 }}>
                    Search for friends, chats, or AI conversations
                </Text>
              </View>
            )
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtext: {
    fontSize: 14,
  },
  time: {
      fontSize: 12,
      marginLeft: 8,
  }
});