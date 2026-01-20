import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '../../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AIService, AIConversation } from '../../src/services/AIService';
import { ChatListElement } from '../../src/components/ChatListElement';
import { Appbar, IconButton, FAB } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

export default function AIChatListScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.background }} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.Content title="AI" titleStyle={{ color: m3.onSurface }} />
      </Appbar.Header>

      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatListElement
            title={item.title}
            subtitle={item.preview || 'No messages yet'}
            time={new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            onPress={() => router.push({ pathname: '/ai-chat/[id]', params: { id: item.id, conversationId: item.id } })}
            onDelete={() => handleDelete(item.id)}
            onArchive={() => handleDelete(item.id)}
            backgroundColor={m3.surface}
            textColor={m3.onSurface}
            subtitleColor={m3.onSurfaceVariant}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadConversations(); }}
            tintColor={m3.primary}
            colors={[m3.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <IconButton icon="chatbubbles-outline" size={64} iconColor={m3.onSurfaceVariant} />
              <Text style={{ color: m3.onSurfaceVariant, marginTop: 16 }}>No chats yet. Start one!</Text>
            </View>
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={handleCreateNew}
        loading={creating}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
    paddingTop: 8,
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
  },
  fab: {
    position: 'absolute',
    right: 16,
  }
});
