import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Alert,
  Image as RNImage,
  ScrollView,
  Keyboard,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { AppBar } from '@/components/app-bar';
import { useSendNotification } from '@/hooks/useSendNotification';
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Attachment = {
  type: 'image' | 'file';
  url: string;
  name?: string;
  size?: number;
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
  const { theme, isDarkMode } = useTheme();
  const { sendNotification } = useSendNotification();
  const insets = useSafeAreaInsets();

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
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuOnLeft, setMenuOnLeft] = useState(true);

  const menuAnimation = useSharedValue(0);
  const menuScale = useSharedValue(0);
  const menuOpacity = useSharedValue(0);

  const closeMenu = () => {
    menuAnimation.value = withTiming(0, { duration: 200 });
    menuScale.value = withSpring(0, { damping: 55, stiffness: 520 });
    menuOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setSelectedMessage)(null);
      runOnJS(setIsMenuClosing)(false);
    });
  };

  const openMenu = (message: Message, x: number, y: number) => {
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = 250;
    
    const isLeft = x < screenWidth / 2;
    
    setMenuPosition({
      x: isLeft ? Math.max(16, x - 16) : Math.min(screenWidth - menuWidth + 16, x - menuWidth + 16),
      y: Math.min(y - 8, Dimensions.get('window').height - 100 - 50)
    });
    setSelectedMessage(message);
    setIsMenuClosing(false);
    menuAnimation.value = withTiming(1, { duration: 200 });
    menuScale.value = withSpring(1, { damping: 55, stiffness: 520 });
    menuOpacity.value = withTiming(1, { duration: 150 });
  };

  useEffect(() => {
    if (selectedMessage) {
      setSelectedMessage(null);
      setIsMenuClosing(false);
    }
  }, [messages.length]);

  useEffect(() => {
    loadCachedMessages();
    fetchMessages(0);
    subscribeToMessages();
    markAsRead();

    return () => {
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (isAttachmentOpen) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsAttachmentOpen(false);
        }
        closeMenu();
      }
    );
    return () => {
      keyboardDidShowListener.remove();
    };
  }, [isAttachmentOpen]);

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

  const handleImagePress = (imageUrl: string) => {
    setViewerImages([{ uri: imageUrl }]);
    setViewerIndex(0);
    setViewerVisible(true);
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Delete error', error);
      Alert.alert('Error', 'Failed to delete message.');
    }
  };

  const MessageItem = React.memo(({
    item,
    index,
    onLongPress,
  }: {
    item: Message;
    index: number;
    onLongPress: (m: Message, x: number, y: number) => void;
  }) => {
    const isMe = item.sender_id === user?.id;
    const newerMessage = messages[index - 1];
    const olderMessage = messages[index + 1];
    const isSameSenderAsNewer = newerMessage && newerMessage.sender_id === item.sender_id;
    const isSameSenderAsOlder = olderMessage && olderMessage.sender_id === item.sender_id;
    const TIME_THRESHOLD = 60 * 1000;
    const isWithinTime = newerMessage && (new Date(newerMessage.created_at).getTime() - new Date(item.created_at).getTime() < TIME_THRESHOLD);
    const isLastInGroup = !isSameSenderAsNewer || !isWithinTime;

    const borderTopLeft = !isMe && isSameSenderAsOlder ? 4 : 20;
    const borderTopRight = isMe && isSameSenderAsOlder ? 4 : 20;
    const borderBottomLeft = !isMe && !isLastInGroup ? 4 : 20;
    const borderBottomRight = isMe && !isLastInGroup ? 4 : 20;

    const bubbleContent = (
      <View style={[
        styles.bubble,
        {
          backgroundColor: isMe ? theme.tint : (isDarkMode ? '#262626' : '#E5E5EA'),
          borderTopLeftRadius: borderTopLeft,
          borderTopRightRadius: borderTopRight,
          borderBottomLeftRadius: borderBottomLeft,
          borderBottomRightRadius: borderBottomRight,
        }
      ]}>
        {item.attachments?.length > 0 && (
          <View style={styles.attachmentContainer}>
            {item.attachments.map((att, idx) => (
              att.type === 'image' ? (
                <TouchableOpacity key={idx} onPress={() => handleImagePress(att.url)}>
                  <Image
                    source={{ uri: att.url }}
                    style={styles.attachmentImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                </TouchableOpacity>
              ) : (
                <View key={idx} style={[styles.fileAttachment, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}>
                  <Ionicons name="document-text" size={24} color={isMe ? '#fff' : theme.text} />
                  <Text style={{ color: isMe ? '#fff' : theme.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
                    {att.name || 'File'}
                  </Text>
                </View>
              )
            ))}
          </View>
        )}
        {!!item.content && (
          <Text style={{ color: isMe ? '#fff' : theme.text, fontSize: 16, lineHeight: 22 }}>
            {item.content}
          </Text>
        )}
      </View>
    );

    return (
      <View style={{ marginBottom: isLastInGroup ? 12 : 2 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={(e) => onLongPress(item, e.nativeEvent.pageX, e.nativeEvent.pageY)}
          style={[styles.messageRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView
              style={styles.liquidGlassBubble}
              interactive
              effect="clear"
            >
              {bubbleContent}
            </LiquidGlassView>
          ) : (
            bubbleContent
          )}
        </TouchableOpacity>

        {isLastInGroup && (
          <View style={[styles.metadataContainer, { justifyContent: isMe ? 'flex-end' : 'flex-start', marginRight: isMe ? 10 : 0 }]}>
            <Text style={[styles.timeText, { color: theme.tabIconDefault }]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
              <Ionicons
                name={item.read_at ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.read_at ? theme.tint : theme.tabIconDefault}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        )}
      </View>
    );
  });

  const MessageContextMenu = () => {
    const isMyMessage = selectedMessage?.sender_id === user?.id;
    const isLeft = menuOnLeft;
    const menuWidth = 250;
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: menuScale.value }],
      transformOrigin: [isLeft ? 0 : menuWidth, 0, 0],
      opacity: menuOpacity.value,
    }));

    const animatedBackdrop = useAnimatedStyle(() => ({
      opacity: menuAnimation.value * 0.3,
      pointerEvents: menuAnimation.value > 0 ? 'auto' : 'none',
    }));

    if (!selectedMessage || menuAnimation.value === 0) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View 
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', position: 'absolute' }, animatedBackdrop]} 
          pointerEvents="auto"
        >
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1}
            onPress={closeMenu}
          />
        </Animated.View>
        <Animated.View style={[
          styles.customMenu,
          animatedStyle,
          {
            backgroundColor: isDarkMode ? '#1c1c1e' : '#fff',
            position: 'absolute',
            left: menuPosition.x,
            top: menuPosition.y,
            width: menuWidth,
          }
        ]}>
          {!!selectedMessage.content && (
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => { copyToClipboard(selectedMessage.content); closeMenu(); }}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>Copy</Text>
              <Ionicons name="copy-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          )}

          {isMyMessage && (
            <>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => { deleteMessage(selectedMessage.id); closeMenu(); }}
              >
                <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete</Text>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    );
  };

  const renderHeaderTitle = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {connectionStatus !== 'connected' && (
        <ActivityIndicator size="small" color={theme.tint} style={{ marginRight: 8 }} />
      )}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
          {connectionStatus === 'connected' ? friendName : 'Connecting...'}
        </Text>
        {connectionStatus === 'connected' && (
          <Text style={{ color: theme.tabIconDefault, fontSize: 11 }}>Online</Text>
        )}
      </View>
    </View>
  );

  const headerHeight = 44 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar
        centerComponent={renderHeaderTitle()}
        isNative={true}
      />

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
          renderItem={({ item, index }) => (
            <MessageItem
              item={item}
              index={index}
              onLongPress={(m, x, y) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                openMenu(m, x, y);
              }}
            />
          )}
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

        <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 6) }]}>
          {attachments.length > 0 && (
            <ScrollView horizontal style={styles.previewContainer} showsHorizontalScrollIndicator={false}>
              {attachments.map((att, i) => (
                <View key={i} style={styles.previewItem}>
                  {att.type === 'image' ? (
                    <RNImage source={{ uri: att.url }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                  ) : (
                    <View style={[styles.filePreview, { borderColor: theme.border }]}>
                      <Ionicons name="document" size={24} color={theme.text} />
                    </View>
                  )}
                  <TouchableOpacity onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={styles.removeAttachment}>
                    <Ionicons name="close-circle" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.innerContainer}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsAttachmentOpen(prev => !prev);
              }}
              style={styles.iconButton}
            >
              <Ionicons name={isAttachmentOpen ? "close" : "add"} size={32} color={theme.tint} />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode ? '#1c1c1e' : '#fff',
                  color: theme.text,
                }
              ]}
              placeholder="Message"
              placeholderTextColor={theme.tabIconDefault}
              value={inputText}
              onChangeText={setInputText}
              multiline
              selectionColor={theme.tint}
            />

            {(inputText.trim().length > 0 || attachments.length > 0) ? (
              <Host>
                <Button
                  onPress={handleSend}
                  disabled={sending}
                  variant="glassProminent"
                  systemImage="arrow.up"
                >
                  Send
                </Button>
              </Host>
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.tabIconDefault }]}
              >
                <Ionicons name="mic" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {isAttachmentOpen && (
            <View style={[styles.attachmentMenu, { borderTopColor: theme.border }]}>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => {}}>
                <View style={[styles.optionIcon, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="image" size={24} color="#fff" />
                </View>
                <Text style={[styles.optionText, { color: theme.text }]}>Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => {}}>
                <View style={[styles.optionIcon, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="document-text" size={24} color="#fff" />
                </View>
                <Text style={[styles.optionText, { color: theme.text }]}>Document</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <MessageContextMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, overflow: 'visible' },
  liquidGlassBubble: { maxWidth: '75%', padding: 0 },
  attachmentContainer: { marginBottom: 6 },
  attachmentImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 4 },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, gap: 8, maxWidth: 200 },
  metadataContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  timeText: { fontSize: 10, opacity: 0.7 },

  inputWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewContainer: { flexDirection: 'row', marginBottom: 0, paddingHorizontal: 10, paddingTop: 10 },
  previewItem: { marginRight: 10, position: 'relative' },
  filePreview: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.1)' },
  removeAttachment: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  attachmentMenu: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, borderTopWidth: StyleSheet.hairlineWidth },
  attachmentOption: { alignItems: 'center' },
  optionIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  optionText: { fontSize: 12, fontWeight: '500' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  iosMenu: {
    borderRadius: 14,
    overflow: 'hidden',
    width: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 17,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  customMenu: {
    borderRadius: 14,
    overflow: 'hidden',
    width: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    zIndex: 1000,
  },
});
