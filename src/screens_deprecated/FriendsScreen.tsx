import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../context/FeatureFlagContext';
import { AppBar } from '../components/AppBar';

type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  friend_profile?: Profile;
};

const Avatar = ({ name }: { name: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <View style={[styles.avatar, { backgroundColor: '#333' }]}>
      <Text style={[styles.avatarText, { color: '#fff' }]}>{initials}</Text>
    </View>
  );
};

export const FriendsScreen = () => {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFriendsAndRequests = async () => {
    if (!user) return;
    try {
      const { data: friendsData, error: friendsError } = await supabase.rpc('get_friends');
      const { data: requestsData, error: requestsError } = await supabase.rpc('get_friend_requests');

      if (friendsError) throw friendsError;
      if (requestsError) throw requestsError;

      const mappedFriends: Friendship[] = (friendsData || []).map((f: any) => ({
        id: f.friendship_id,
        user_id: user.id,
        friend_id: f.friend_id,
        status: f.status,
        friend_profile: {
          id: f.friend_id,
          username: f.username,
          full_name: f.full_name,
          avatar_url: f.avatar_url
        }
      }));

      const mappedRequests: Friendship[] = (requestsData || []).map((f: any) => ({
        id: f.friendship_id,
        user_id: f.friend_id,
        friend_id: user.id,
        status: f.status,
        friend_profile: {
          id: f.friend_id,
          username: f.username,
          full_name: f.full_name,
          avatar_url: f.avatar_url
        }
      }));
      
      setFriends(mappedFriends);
      setRequests(mappedRequests);

    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFriendsAndRequests();
    }, [user])
  );

  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_users', { query_text: searchQuery });

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to search users.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (targetUserId: string) => {
    if (!user) return;
    try {
        const { error } = await supabase.rpc('send_friend_request', { target_user_id: targetUserId });
        if (error) throw error;
        Alert.alert('Success', 'Friend request sent!');
        setSearchQuery('');
        setSearchResults([]);
        fetchFriendsAndRequests();
    } catch (error: any) {
        Alert.alert('Error', error.message);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
      try {
          const { error } = await supabase.rpc('accept_friend_request', { request_id: friendshipId });
          if (error) throw error;
          fetchFriendsAndRequests();
      } catch (error: any) {
          Alert.alert('Error', error.message);
      }
  };

  const handleRemoveFriend = async (friendshipId: string, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('remove_friend', { target_friendship_id: friendshipId });
              if (error) throw error;
              fetchFriendsAndRequests();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const openChat = (friendId: string, friendName: string, friendAvatar: string | null) => {
      router.push({
          pathname: '/chat/[id]',
          params: {
              id: friendId,
              friendId,
              friendName,
              friendAvatar: friendAvatar || undefined
          }
      });
  };

  const renderFriendItem = ({ item }: { item: Friendship }) => (
    <TouchableOpacity 
      style={styles.itemContainer} 
      activeOpacity={0.7}
      onLongPress={() => handleRemoveFriend(item.id, item.friend_profile?.full_name || item.friend_profile?.username || 'User')}
      onPress={() => openChat(item.friend_profile!.id, item.friend_profile!.full_name, item.friend_profile?.avatar_url || null)}
    >
      <Avatar name={item.friend_profile?.full_name || item.friend_profile?.username || '?'} />
      <View style={styles.textContainer}>
        <Text style={[styles.name, { color: theme.text }]}>
            {item.friend_profile?.full_name}
        </Text>
        <Text style={[styles.username, { color: theme.tabIconDefault }]}>
            @{item.friend_profile?.username}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.iconButton, { backgroundColor: '#222' }]}
        onPress={() => openChat(item.friend_profile!.id, item.friend_profile!.full_name, item.friend_profile?.avatar_url || null)}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.tint} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRequestItem = ({ item }: { item: Friendship }) => (
    <View style={styles.itemContainer}>
       <Avatar name={item.friend_profile?.full_name || '?'} />
       <View style={styles.textContainer}>
        <Text style={[styles.name, { color: theme.text }]}>Request from</Text>
        <Text style={[styles.username, { color: theme.text, fontWeight: 'bold' }]}>
            {item.friend_profile?.username}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: theme.tint }]}
        onPress={() => handleAcceptRequest(item.id)}
      >
          <Text style={styles.actionButtonText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchResult = ({ item }: { item: Profile }) => (
      <View style={styles.itemContainer}>
          <Avatar name={item.full_name || item.username} />
          <View style={styles.textContainer}>
              <Text style={[styles.name, { color: theme.text }]}>{item.full_name}</Text>
              <Text style={[styles.username, { color: theme.tabIconDefault }]}>@{item.username}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.tint }]}
            onPress={() => handleAddFriend(item.id)}
          >
              <Ionicons name="person-add" size={16} color="#fff" />
          </TouchableOpacity>
      </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar title="People" isNative={true} showBackButton={false} />
      {/* Header Search */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="search" size={20} color={theme.tabIconDefault} style={{ marginRight: 8 }} />
              <TextInput 
                  placeholder="Search by username..." 
                  placeholderTextColor={theme.tabIconDefault}
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                      <Ionicons name="close-circle" size={18} color={theme.tabIconDefault} />
                  </TouchableOpacity>
              )}
          </View>
      </View>

      <FlatList
        data={searchQuery.length > 0 ? (searchResults as any[]) : (friends as any[])}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFriendsAndRequests(); }} tintColor={theme.tint} />}
        ListHeaderComponent={() => (
            <>
                {searchQuery.length > 0 && searchResults.length === 0 && !isSearching && (
                    <Text style={[styles.sectionHeader, { color: theme.tabIconDefault, textAlign: 'center', marginTop: 20 }]}>
                        No users found.
                    </Text>
                )}

                {searchQuery.length === 0 && requests.length > 0 && (
                    <View>
                        <Text style={[styles.sectionHeader, { color: theme.tabIconDefault }]}>FRIEND REQUESTS</Text>
                        {requests.map(req => (
                            <View key={req.id}>{renderRequestItem({ item: req })}</View>
                        ))}
                         <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 0 }]} />
                    </View>
                )}
                 {searchQuery.length === 0 && <Text style={[styles.sectionHeader, { color: theme.tabIconDefault }]}>FRIENDS</Text>}
            </>
        )}
        renderItem={({ item }) => {
            if (searchQuery.length > 0) return renderSearchResult({ item: item as Profile });
            return renderFriendItem({ item: item as Friendship });
        }}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        ListEmptyComponent={() => (
            !loading && !isSearching && searchQuery.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50, opacity: 0.5 }}>
                    <Ionicons name="people-outline" size={64} color={theme.text} />
                    <Text style={{ color: theme.text, marginTop: 10 }}>No friends yet.</Text>
                    <Text style={{ color: theme.text, fontSize: 12 }}>Search for a username to connect!</Text>
                </View>
            ) : null
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      zIndex: 10,
  },
  searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 40,
      borderRadius: 20,
      paddingHorizontal: 12,
  },
  searchInput: {
      flex: 1,
      height: '100%',
      fontSize: 16,
  },
  listContent: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  sectionHeader: {
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 10,
      marginTop: 20,
      marginLeft: 16,
      opacity: 0.7,
      letterSpacing: 1,
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
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  username: {
      fontSize: 14,
  },
  status: {
    fontSize: 13,
  },
  iconButton: {
      padding: 10,
      borderRadius: 20,
      marginLeft: 10,
  },
  actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
  },
  actionButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 82,
  },
});
