import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Image,
  Modal,
  Pressable,
  useWindowDimensions,
  Linking,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  useDerivedValue
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Appbar, IconButton, Text as RNPText, Card, Divider, TouchableRipple, ActivityIndicator as RNPActivityIndicator, FAB, Surface, Portal, Dialog, Button, ProgressBar, Menu } from 'react-native-paper';

import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useSendNotification } from '../../src/hooks/useSendNotification';
import { DeepLinkUserWidget } from '../../src/components/DeepLinkUserWidget.android';
import { Colors } from '../../src/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MainStackParamList = {
  AIChat: undefined;
};

type Attachment = {
  type: 'image' | 'file' | 'audio';
  url: string;
  name?: string;
  size?: number;
  duration?: number;
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read_at: string | null;
  attachments: Attachment[];
  is_edited: boolean;
};

export default function SingleChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendId = params.friendId as string;
  const friendName = params.friendName as string;
  const friendAvatar = params.friendAvatar as string | undefined;

  const { user, profile } = useAuth();
  const { isDarkMode } = useTheme();
  const { sendNotification } = useSendNotification();
  const insets = useSafeAreaInsets();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const flatListRef = useRef<FlatList>(null);
  const CACHE_KEY = `chat_${user?.id}_${friendId}`;
  const subscriptionRef = useRef<any>(null);
  const isInitialLoad = useRef(true);
  const reconnectTimeoutRef = useRef<any>(null);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadCachedMessages();
    fetchMessages(0);
    subscribeToMessages();
    markAsRead();

    return () => {
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (isAttachmentMenuOpen) {
      Keyboard.dismiss();
    }
  }, [isAttachmentMenuOpen]);

  const loadCachedMessages = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setMessages(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.log('Error loading cache', e);
    }
  };

  const cacheMessages = async (msgs: Message[]) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(msgs));
    } catch (e) {
      console.log('Error caching messages', e);
    }
  };

  const getStableKey = (msg: Message) => {
    return `${msg.sender_id}_${msg.content}_${msg.created_at.substring(0, 16)}`;
  };

  const deduplicateMessages = (newMsgs: Message[], existingMsgs: Message[]) => {
    const combined = [...newMsgs, ...existingMsgs];
    const seenIds = new Set();
    const result: Message[] = [];

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const msg of combined) {
      if (seenIds.has(msg.id)) continue;

      const isOptimistic = msg.id.startsWith('opt_');
      if (isOptimistic) {
        const realMatch = combined.find(m =>
          !m.id.startsWith('opt_') &&
          m.sender_id === msg.sender_id &&
          m.content === msg.content &&
          Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 60000
        );
        if (realMatch) continue;
      }

      seenIds.add(msg.id);
      result.push(msg);
    }
    return result;
  };

  const fetchMessages = async (pageNumber: number) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (data.length < PAGE_SIZE) setHasMore(false);

      if (data.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setMessages(prev => {
          const merged = deduplicateMessages(data, prev);
          if (pageNumber === 0) cacheMessages(merged.slice(0, 50));
          return merged;
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (subscriptionRef.current && subscriptionRef.current.state === 'joined') return;
    if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);

    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`chat:${user?.id}:${friendId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === friendId || newMsg.receiver_id === friendId) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMessages(prev => {
              const updated = deduplicateMessages([newMsg], prev);
              cacheMessages(updated.slice(0, 50));
              return updated;
            });
            if (newMsg.sender_id === friendId) markAsRead();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updatedMsg = payload.new as Message;
          if (updatedMsg.sender_id === friendId || updatedMsg.receiver_id === friendId) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          if (!isInitialLoad.current) fetchMessages(0);
          isInitialLoad.current = false;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => subscribeToMessages(), 5000);
        }
      });

    subscriptionRef.current = channel;
  };

  const markAsRead = async () => {
    if (!user) return;
    await supabase.rpc('mark_messages_read', { p_sender_id: friendId });
  };

  const handleSend = async () => {
    if ((!inputText.trim() && attachments.length === 0) || !user) return;
    setSending(true);

    const optimisticMsg: Message = {
      id: `opt_${Date.now()}_${Math.random()}`,
      sender_id: user.id,
      receiver_id: friendId,
      content: inputText,
      attachments: attachments,
      created_at: new Date().toISOString(),
      read_at: null,
      is_edited: false
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages(prev => [optimisticMsg, ...prev]);
    setInputText('');
    setAttachments([]);

    try {
      const { error } = await supabase.rpc('rpc_send_message', {
        p_sender_id: user.id,
        p_receiver_id: friendId,
        p_content: inputText,
        p_attachments: attachments,
      });
      if (error) throw error;

      sendNotification({
        userId: friendId,
        title: profile?.full_name || 'New Message',
        body: optimisticMsg.content || 'Sent an attachment',
        screen: 'SingleChat',
        params: { friendId: user.id, friendName: profile?.full_name || 'Friend' }
      }).catch(err => console.error('Notification failed', err));

    } catch (error: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (event: any, message: Message) => {
    const { nativeEvent } = event;
    setMenuAnchor({ x: nativeEvent.pageX, y: nativeEvent.pageY });
    setSelectedMessage(message);
    setMenuVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedMessage(null);
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeMenu();
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
      closeMenu();
    } catch (error) {
      console.error('Delete error', error);
    }
  };

  const renderHeaderTitle = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {connectionStatus !== 'connected' && (
        <RNPActivityIndicator size="small" color={m3.primary} style={{ marginRight: 8 }} />
      )}
      <View>
        <RNPText variant="titleMedium" style={{ color: m3.onSurface }}>
          {connectionStatus === 'connected' ? friendName : 'Connecting...'}
        </RNPText>
        {connectionStatus === 'connected' && (
          <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>Online</RNPText>
        )}
      </View>
    </View>
  );

  const headerHeight = (Platform.OS === 'ios' ? 64 : 56) + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={renderHeaderTitle()} />
        <Appbar.Action icon="dots-vertical" onPress={() => {}} color={m3.onSurface} />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => getStableKey(item) + '_' + item.id}
          renderItem={({ item, index }) => {
            const isMe = item.sender_id === user?.id;
            const newerMessage = messages[index - 1];
            const isSameSender = newerMessage && newerMessage.sender_id === item.sender_id;
            const TIME_THRESHOLD = 60 * 1000;
            const isWithinTime = newerMessage && (new Date(newerMessage.created_at).getTime() - new Date(item.created_at).getTime() < TIME_THRESHOLD);
            const isLastInGroup = !isSameSender || !isWithinTime;

            const renderContent = (content: string) => {
              const regex = /(?:^|\s)hlt:\/\/chat\?username=([a-zA-Z0-9_]+)(?:$|\s)/g;
              const parts = [];
              let lastIndex = 0;
              let match;

              while ((match = regex.exec(content)) !== null) {
                // Add text before the match
                if (match.index > lastIndex) {
                   // We render the Markdown component for regular text
                   parts.push(
                     <View key={`text-${lastIndex}`}>
                       <Markdown
                          style={{
                            body: {
                              color: isMe ? m3.onPrimaryContainer : m3.onSurface,
                              fontSize: 15,
                              marginVertical: 2,
                            },
                          }}
                        >
                          {content.substring(lastIndex, match.index)}
                        </Markdown>
                     </View>
                   );
                }
                // Add the widget
                parts.push(
                  <View key={`widget-${match.index}`} style={{ marginVertical: 4 }}>
                    <DeepLinkUserWidget username={match[1]} />
                  </View>
                );
                lastIndex = regex.lastIndex;
              }

              // Add remaining text
              if (lastIndex < content.length) {
                parts.push(
                   <View key={`text-${lastIndex}`}>
                       <Markdown
                          style={{
                            body: {
                              color: isMe ? m3.onPrimaryContainer : m3.onSurface,
                              fontSize: 15,
                              marginVertical: 2,
                            },
                          }}
                        >
                          {content.substring(lastIndex)}
                        </Markdown>
                   </View>
                );
              }

              if (parts.length === 0) {
                 return (
                    <Markdown
                        style={{
                          body: {
                            color: isMe ? m3.onPrimaryContainer : m3.onSurface,
                            fontSize: 15,
                            marginVertical: 2,
                            marginTop: 2,
                            marginBottom: 2,
                            paddingVertical: 0,
                          },
                          paragraph: {
                            marginVertical: 2,
                            marginTop: 2,
                            marginBottom: 2,
                          },
                          link: {
                            color: isMe ? m3.onPrimaryContainer : m3.primary,
                          },
                          strong: {
                            fontWeight: 'bold',
                          },
                          em: {
                            fontStyle: 'italic',
                          },
                          code: {
                            backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 4,
                            fontFamily: 'monospace',
                          },
                          pre: {
                            backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                            padding: 8,
                            borderRadius: 8,
                          },
                          blockquote: {
                            borderLeftWidth: 3,
                            borderLeftColor: m3.primary,
                            paddingLeft: 8,
                            marginLeft: 0,
                            color: isMe ? m3.onPrimaryContainer : m3.onSurfaceVariant,
                          },
                        }}
                      >
                        {content}
                      </Markdown>
                 );
              }

              return <View>{parts}</View>;
            };

            return (
              <View style={{ marginBottom: isLastInGroup ? 12 : 2 }}>
                <TouchableRipple
                  onLongPress={(e) => handleLongPress(e, item)}
                  style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                >
                    <Surface
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: isMe ? m3.primaryContainer : m3.surface,
                        borderTopLeftRadius: !isMe && !isLastInGroup ? 4 : 16,
                        borderTopRightRadius: isMe && !isLastInGroup ? 4 : 16,
                        borderBottomLeftRadius: !isMe ? 4 : 16,
                        borderBottomRightRadius: isMe ? 4 : 16,
                        maxWidth: '75%'
                      }
                    ]}
                    elevation={0}
                  >
                    {item.attachments?.length > 0 && (
                      <View style={styles.attachmentContainer}>
                        {item.attachments.map((att: Attachment, idx: number) => (
                          <View key={idx} style={[styles.fileAttachment, { backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainer }]}>
                            <Ionicons name="document-text" size={24} color={isMe ? '#fff' : m3.onSurface} />
                            <RNPText variant="bodyMedium" style={{ color: isMe ? m3.onPrimaryContainer : m3.onSurface }} numberOfLines={1}>
                              {att.name || 'File'}
                            </RNPText>
                          </View>
                        ))}
                      </View>
                    )}
                    {!!item.content && renderContent(item.content)}
                  </Surface>
                </TouchableRipple>

                {isLastInGroup && (
                  <View style={[styles.metadataContainer, { justifyContent: isMe ? 'flex-end' : 'flex-start', marginRight: isMe ? 10 : 0 }]}>
                    <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </RNPText>
                    {isMe && (
                      <Ionicons
                        name={item.read_at ? "checkmark-done" : "checkmark"}
                        size={14}
                        color={item.read_at ? m3.primary : m3.onSurfaceVariant}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          }}
          inverted
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          onEndReached={() => {
            if (hasMore && !loading) {
              setPage(p => {
                const nextPage = p + 1;
                fetchMessages(nextPage);
                return nextPage;
              });
            }
          }}
          onEndReachedThreshold={0.5}
        />

        <View style={[styles.inputWrapper, { backgroundColor: m3.background }]}>
          {attachments.length > 0 && (
            <ScrollView horizontal style={styles.previewContainer} showsHorizontalScrollIndicator={false}>
              {attachments.map((att, i) => (
                <View key={i} style={styles.previewItem}>
                  <View style={[styles.filePreview, { borderColor: m3.outline }]}>
                    <Ionicons name="document" size={24} color={m3.onSurface} />
                  </View>
                  <IconButton
                    icon="close"
                    size={16}
                    iconColor={m3.onSurface}
                    style={styles.removeAttachment}
                    onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  />
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.innerContainer}>
            <View style={styles.inputBarContainer}>
              <View style={[styles.plusButton, { backgroundColor: m3.secondaryContainer }]}>
                <IconButton
                  icon="plus"
                  size={26}
                  iconColor={m3.onSecondaryContainer}
                  onPress={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                  style={styles.plusIcon}
                />
              </View>
              <View style={[styles.textBoxWrapper, { backgroundColor: m3.surfaceContainerHighest }]}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: 'transparent',
                      color: m3.onSurface,
                    }
                  ]}
                  placeholder="Message"
                  placeholderTextColor={m3.onSurfaceVariant}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  selectionColor={m3.primary}
                />
                <IconButton
                  icon="camera"
                  size={20}
                  iconColor={m3.onSurfaceVariant}
                  onPress={() => {}}
                  style={styles.internalIcon}
                />
              </View>
              <TouchableRipple
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
                style={[styles.circleButton, { backgroundColor: m3.primary }, (!inputText.trim() || sending) && { opacity: 0.5 }]}
              >
                <View style={styles.circleButtonContent}>
                  {sending ? (
                    <RNPActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name={inputText.trim().length > 0 ? 'send' : 'mic'} size={20} color="#fff" />
                  )}
                </View>
              </TouchableRipple>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Menu
        visible={menuVisible}
        onDismiss={closeMenu}
        anchor={menuAnchor}
      >
        <Menu.Item onPress={() => selectedMessage && copyToClipboard(selectedMessage.content)} title="Copy" leadingIcon="content-copy" />
        {selectedMessage?.sender_id === user?.id && (
          <Menu.Item onPress={() => selectedMessage && deleteMessage(selectedMessage.id)} title="Delete" titleStyle={{ color: m3.error }} leadingIcon="delete" />
        )}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10 },
  bubble: { paddingHorizontal: 10, paddingVertical: 2, overflow: 'visible' },
  attachmentContainer: { marginBottom: 8 },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8, maxWidth: 200 },
  metadataContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 0 },

  inputWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  innerContainer: {
    width: '100%',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    padding: 4,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  plusIcon: {
    margin: 0,
  },
  plusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textBoxWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 0,
    marginRight: 8,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 8,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  floatingInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonContent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  internalIcon: {
    margin: 0,
    marginRight: 4,
  },
  circleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  circleButtonContent: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewContainer: { flexDirection: 'row', marginBottom: 0, paddingHorizontal: 10, paddingTop: 10 },
  previewItem: { marginRight: 10, position: 'relative' },
  filePreview: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.1)' },
  removeAttachment: { position: 'absolute', top: -8, right: -8, margin: 0 },

  menuDialog: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 200,
  },
});