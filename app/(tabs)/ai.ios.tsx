import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { AIService, AIConversation } from '../../src/services/AIService';
import { Button, Host } from '@expo/ui/swift-ui';
import { LiquidGlassContainerView, LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';

export default function AIChatListScreen() {
  const { theme } = useTheme();
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

  return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor={theme.tint} />}
        >
          {!loading && conversations.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ color: theme.tabIconDefault }}>No chats yet. Start one!</Text>
            </View>
          )}

          <LiquidGlassContainerView spacing={0}>
            {conversations.map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push({ pathname: '/ai-chat/[id]', params: { id: item.id, conversationId: item.id } })}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.7}
              >
                <LiquidGlassView
                  style={styles.itemContainer}
                  interactive
                  effect="clear"
                >
                  <View style={styles.textContainer}>
                    <View style={styles.headerRow}>
                      <Text style={[styles.title, { color: theme.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.time, { color: theme.tabIconDefault }]}>
                        {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.subtitle, { color: theme.tabIconDefault }]}
                    >
                      {item.preview || 'No messages yet'}
                    </Text>
                  </View>
                </LiquidGlassView>
              </TouchableOpacity>
            ))}
          </LiquidGlassContainerView>
        </ScrollView>

        <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
          <Host>
          <Button
            onPress={handleCreateNew}
            variant="glass"
          >
          Create New
          </Button>
          </Host>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    listContent: { 
      paddingBottom: 100, 
      paddingTop: 60,
      paddingHorizontal: 16 
    },
    empty: { alignItems: 'center', marginTop: 50 },
    fabContainer: {
      position: 'absolute',
      left: 20,
      right: 20,
      height: 50,
    },
    itemContainer: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
    },
    textContainer: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
    },
    time: {
      fontSize: 12,
    },
    subtitle: {
      fontSize: 14,
    }
});