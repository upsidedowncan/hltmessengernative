import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { AIService, AIConversation } from '@/services/ai-service';
import { Button, Host } from '@expo/ui/swift-ui';
import { LiquidGlassContainerView, LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

  const renderConversationItem = (item: AIConversation) => {
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => router.push({ pathname: '/ai-chat/[id]', params: { id: item.id, conversationId: item.id } })}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.itemContainer}>
           <View style={[styles.avatar, { backgroundColor: theme.tint + '20' }]}>
               <MaterialCommunityIcons name="robot" size={26} color={theme.tint} />
           </View>
           <View style={styles.textContainer}>
             <View style={styles.headerRow}>
               <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
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
        </View>
        <View style={[styles.separator, { backgroundColor: theme.borderColor }]} />
      </TouchableOpacity>
    );
  };

  return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { marginTop: insets.top + 20 }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>AI Space</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor={theme.tint} />}
          showsVerticalScrollIndicator={false}
        >
          {!loading && conversations.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ color: theme.tabIconDefault }}>No chats yet. Start one!</Text>
            </View>
          )}

          <View style={styles.conversationsList}>
            {conversations.map(item => renderConversationItem(item))}
          </View>
        </ScrollView>

        <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
          <Host>
          <Button
            onPress={handleCreateNew}
            variant="glass"
          >
          New AI Chat
          </Button>
          </Host>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    listContent: { 
      paddingTop: 10,
    },
    conversationsList: {
        marginTop: 0,
    },
    empty: { 
        alignItems: 'center', 
        marginTop: 100 
    },
    fabContainer: {
      position: 'absolute',
      left: 20,
      right: 20,
      height: 50,
    },
    itemContainer: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      flex: 1,
      paddingRight: 8,
    },
    time: {
      fontSize: 14,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 18,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 76,
    }
  });
