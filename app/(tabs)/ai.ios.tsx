import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/context/FeatureFlagContext';
import { AIService, AIConversation } from '../../src/services/AIService';
import { ChatListElement } from '../../src/components/ChatListElement';
import { Button, Host } from '@expo/ui/swift-ui';

export default function AIChatListScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadConversations = async () => {
    const data = await AIService.getConversations();
    setConversations(data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const handleCreateNew = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await AIService.createConversation();
      router.push({ pathname: '/ai-chat/[id]', params: { id, conversationId: id } });
    } catch (e) {
      console.error('Failed to create conversation', e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Chat', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            await AIService.deleteConversation(id);
            loadConversations();
        }}
    ]);
  };

  const renderItem = ({ item }: { item: AIConversation }) => (
    <ChatListElement
      title={item.title}
      subtitle={item.preview || 'No messages yet'}
      time={new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      onPress={() => router.push({ pathname: '/ai-chat/[id]', params: { id: item.id, conversationId: item.id } })}
      onDelete={() => handleDelete(item.id)}
      onArchive={() => handleDelete(item.id)}
    />
  );

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor={theme.tint} />}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={{ color: theme.tabIconDefault }}>No chats yet. Start one!</Text></View> : null}
      />
      <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
        <Button
          variant="default"
          onPress={handleCreateNew}
        >
          New Chat
        </Button>
      </View>
    </Host>
  );
};

const styles = StyleSheet.create({
  listContent: { paddingBottom: 100, paddingTop: 60 },
  empty: { alignItems: 'center', marginTop: 50 },
  fabContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 50,
  }
});
