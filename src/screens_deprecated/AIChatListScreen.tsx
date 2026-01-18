import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import { AIService, AIConversation } from '../services/AIService';
import { AppBar } from '../components/AppBar';
import { ChatListElement } from '../components/ChatListElement';
import { FloatingActionButton } from '../components/FloatingActionButton';

export const AIChatListScreen = () => {
  const { theme, isDarkMode } = useAppTheme();
  const router = useRouter();
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
      onArchive={() => handleDelete(item.id)} // Archive behavior not implemented yet
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar 
        title="AI Chats"
        isNative={true}
        showBackButton={false}
      />
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor={theme.tint} />}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={{ color: theme.tabIconDefault }}>No chats yet. Start one!</Text></View> : null}
      />
      <FloatingActionButton onPress={handleCreateNew} icon="create-outline" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 50 },
});