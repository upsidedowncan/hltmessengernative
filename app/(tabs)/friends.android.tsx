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
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '../../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Surface, Searchbar, Chip, Button, IconButton } from 'react-native-paper';

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

const Avatar = ({ name, backgroundColor }: { name: string; backgroundColor: string }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
};

export default function FriendsScreen() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

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
      onPress={() => openChat(item.friend_profile!.id, item.friend_profile!.full_name, item.friend_profile?.avatar_url || null)}
      onLongPress={() => handleRemoveFriend(item.id, item.friend_profile?.full_name || item.friend_profile?.username || 'User')}
    >
      <Surface style={[styles.itemContainer, { backgroundColor: m3.surface }]} elevation={0}>
        <Avatar name={item.friend_profile?.full_name || item.friend_profile?.username || '?'} backgroundColor={m3.secondaryContainer} />
        <View style={styles.textContainer}>
          <Text style={[styles.name, { color: m3.onSurface }]}>
            {item.friend_profile?.full_name}
          </Text>
          <Text style={[styles.username, { color: m3.onSurfaceVariant }]}>
            @{item.friend_profile?.username}
          </Text>
        </View>
        <IconButton
          icon="chatbubble-ellipses-outline"
          size={20}
          iconColor={m3.primary}
          onPress={() => openChat(item.friend_profile!.id, item.friend_profile!.full_name, item.friend_profile?.avatar_url || null)}
        />
      </Surface>
    </TouchableOpacity>
  );

  const renderRequestItem = ({ item }: { item: Friendship }) => (
    <Surface style={[styles.itemContainer, { backgroundColor: m3.surface }]} elevation={0}>
       <Avatar name={item.friend_profile?.full_name || '?'} backgroundColor={m3.secondaryContainer} />
       <View style={styles.textContainer}>
        <Text style={[styles.name, { color: m3.onSurfaceVariant }]}>Request from</Text>
        <Text style={[styles.username, { color: m3.onSurface, fontWeight: '600' }]}>
            {item.friend_profile?.username}
        </Text>
      </View>
      <Button
        mode="contained"
        onPress={() => handleAcceptRequest(item.id)}
        buttonColor={m3.primary}
        contentStyle={{ paddingHorizontal: 16 }}
        labelStyle={{ fontSize: 12 }}
      >
        Accept
      </Button>
    </Surface>
  );

  const renderSearchResult = ({ item }: { item: Profile }) => (
      <Surface style={[styles.itemContainer, { backgroundColor: m3.surface }]} elevation={0}>
          <Avatar name={item.full_name || item.username} backgroundColor={m3.secondaryContainer} />
          <View style={styles.textContainer}>
              <Text style={[styles.name, { color: m3.onSurface }]}>{item.full_name}</Text>
              <Text style={[styles.username, { color: m3.onSurfaceVariant }]}>@{item.username}</Text>
          </View>
          <IconButton
            icon="account-plus"
            size={20}
            iconColor={m3.primary}
            onPress={() => handleAddFriend(item.id)}
          />
      </Surface>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.background }} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.Content title="People" titleStyle={{ color: m3.onSurface }} />
      </Appbar.Header>

      <View style={[styles.header, { backgroundColor: m3.surface }]}>
        <Searchbar
          placeholder="Search by username..."
          placeholderTextColor={m3.onSurfaceVariant}
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          style={{ backgroundColor: m3.surfaceContainerHighest, elevation: 0 }}
          iconColor={m3.onSurfaceVariant}
          inputStyle={{ color: m3.onSurface }}
          theme={{
            colors: {
              background: m3.surfaceContainerHighest,
              onSurface: m3.onSurface,
              onSurfaceVariant: m3.onSurfaceVariant,
              primary: m3.primary,
            }
          }}
        />
      </View>

      <FlatList
        data={searchQuery.length > 0 ? (searchResults as any[]) : (friends as any[])}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchFriendsAndRequests(); }}
            tintColor={m3.primary}
            colors={[m3.primary]}
          />
        }
        ListHeaderComponent={() => (
            <>
                {searchQuery.length > 0 && searchResults.length === 0 && !isSearching && (
                    <Text style={[styles.sectionHeader, { color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 20 }]}>
                        No users found.
                    </Text>
                )}

                {searchQuery.length === 0 && requests.length > 0 && (
                    <View>
                        <Chip style={[styles.chip, { backgroundColor: m3.secondaryContainer }]} textStyle={{ color: m3.onSecondaryContainer }}>
                          FRIEND REQUESTS
                        </Chip>
                        {requests.map(req => (
                            <View key={req.id}>{renderRequestItem({ item: req })}</View>
                        ))}
                         <View style={[styles.separator, { backgroundColor: m3.outlineVariant, marginLeft: 0 }]} />
                    </View>
                )}
                 {searchQuery.length === 0 && (
                   <Chip style={[styles.chip, { backgroundColor: m3.secondaryContainer }]} textStyle={{ color: m3.onSecondaryContainer }}>
                     FRIENDS
                   </Chip>
                 )}
            </>
        )}
        renderItem={({ item }) => {
            if (searchQuery.length > 0) return renderSearchResult({ item: item as Profile });
            return renderFriendItem({ item: item as Friendship });
        }}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: m3.outlineVariant }]} />}
        ListEmptyComponent={() => (
            !loading && !isSearching && searchQuery.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                  <IconButton icon="account-group-outline" size={64} iconColor={m3.onSurfaceVariant} />
                  <Text style={{ color: m3.onSurface, marginTop: 16 }}>No friends yet.</Text>
                  <Text style={{ color: m3.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>Search for a username to connect!</Text>
                </View>
            ) : null
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  chip: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  sectionHeader: {
      fontSize: 12,
      fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
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
    color: '#fff',
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 82,
  },
});
