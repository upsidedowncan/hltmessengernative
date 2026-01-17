import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/FeatureFlagContext';
import { MainStackParamList } from '../navigation/MainNavigator';
import { AIService, AIConversation } from '../services/AIService';
import { AppBar } from '../components/AppBar';
import { ChatListElement } from '../components/ChatListElement';

export const AIChatListScreen = () => {
  const { theme, isDarkMode } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    const id = await AIService.createConversation();
    navigation.navigate('AIChat', { conversationId: id });
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

  const renderHeaderTitle = () => (
    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>AI Chats</Text>
  );

  const renderItem = ({ item }: { item: AIConversation }) => (
    <ChatListElement
      title={item.title}
      subtitle={item.preview || 'No messages yet'}
      time={new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      onPress={() => navigation.navigate('AIChat', { conversationId: item.id })}
      onDelete={() => handleDelete(item.id)}
      onArchive={() => handleDelete(item.id)} // Archive behavior not implemented yet
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar 
        centerComponent={renderHeaderTitle()}
        rightComponent={
            <TouchableOpacity onPress={handleCreateNew}>
                <Ionicons name="create-outline" size={24} color={theme.tint} />
            </TouchableOpacity>
        }
      />
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor={theme.tint} />}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={{ color: theme.tabIconDefault }}>No chats yet. Start one!</Text></View> : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 50 },
});