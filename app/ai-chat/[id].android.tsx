import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, FlatList, Platform, Dimensions, LayoutAnimation, UIManager, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useDerivedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import Markdown from 'react-native-markdown-display';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Appbar, IconButton, Text as RNPText, Surface, TouchableRipple, FAB, Portal, ActivityIndicator as RNPActivityIndicator } from 'react-native-paper';
import { useTheme } from '../../src/context/ThemeContext';
import { AIService, AISettings, DEFAULT_AI_SETTINGS } from '../../src/services/AIService';

const { width } = Dimensions.get('window');
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Message = { id: string; content: string; sender_id: 'user' | 'ai' | 'system'; created_at: string; is_streaming?: boolean; };

const MessageItem = ({ item, onCopy, playingId, speakingLoading, onSpeak }: any) => {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  const isMe = item.sender_id === 'user';

  if (item.sender_id === 'system') {
    return (
      <View style={[styles.systemOutput, { backgroundColor: m3.surfaceContainer }]}>
        <RNPText variant="labelMedium" style={{ color: m3.onSurfaceVariant }}>SYSTEM OUTPUT</RNPText>
        <RNPText variant="bodyMedium" style={{ color: m3.onSurface, marginTop: 4 }}>{item.content}</RNPText>
      </View>
    );
  }

  const parseContent = (content: string) => {
    if (content.includes('<think>') && content.includes('</think>')) {
      const match = content.match(/<think>([\s\S]*?)<\/think>/);
      return match ? { hasThink: true, think: match[1].trim(), text: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() } : { hasThink: false, text: content };
    }
    return { hasThink: false, text: content };
  };

  const { hasThink, think, text } = parseContent(item.content);

  return (
    <View style={{ marginBottom: 12, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      {hasThink && think && <ReasoningAccordion content={think} isRunning={item.is_streaming} m3={m3} />}
      {text && (
        <TouchableRipple onLongPress={() => onCopy(text)}>
          <Surface style={[styles.bubble, { backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainerHighest, borderTopLeftRadius: !isMe ? 4 : 16, borderTopRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, maxWidth: '85%' }]} elevation={0}>
            <Markdown
              style={{
                body: {
                  color: isMe ? m3.onPrimaryContainer : m3.onSurface,
                  fontSize: 15,
                },
                link: {
                  color: m3.primary,
                },
                strong: {
                  fontWeight: 'bold',
                },
                em: {
                  fontStyle: 'italic',
                },
                code: {
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 4,
                  fontFamily: 'monospace',
                },
                pre: {
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  padding: 8,
                  borderRadius: 8,
                },
                blockquote: {
                  borderLeftWidth: 3,
                  borderLeftColor: m3.primary,
                  paddingLeft: 8,
                  marginLeft: 0,
                  color: m3.onSurfaceVariant,
                },
                bullet_list: {
                  marginTop: 0,
                },
                ordered_list: {
                  marginTop: 0,
                },
                list_item: {
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                },
                bullet_list_icon: {
                  marginRight: 8,
                  marginTop: 2,
                },
                ordered_list_icon: {
                  marginRight: 8,
                  marginTop: 0,
                },
              }}
            >
              {text}
            </Markdown>
          </Surface>
        </TouchableRipple>
      )}
      {item.is_streaming && (
        <Surface style={[styles.bubble, { backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainerHighest, borderRadius: 16 }]} elevation={0}>
          <RNPText style={{ color: isMe ? m3.onPrimaryContainer : m3.onSurface }}>...</RNPText>
        </Surface>
      )}
      <View style={[styles.meta, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
        <RNPText variant="labelSmall" style={{ color: m3.onSurfaceVariant }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</RNPText>
      </View>
    </View>
  );
};

const ReasoningAccordion = ({ content, isRunning, m3 }: any) => {
  const [expanded, setExpanded] = useState(isRunning || false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const progress = useDerivedValue(() => expanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 250 }));
  const bodyStyle = useAnimatedStyle(() => ({ height: measuredHeight * progress.value, opacity: progress.value }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 90}deg` }] }));

  return (
    <View style={[styles.thinkContainer, { borderColor: m3.outline, backgroundColor: m3.surface }]}>
      <TouchableRipple onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
          <Animated.View style={arrowStyle}><Ionicons name="chevron-forward" size={16} color={m3.onSurfaceVariant} /></Animated.View>
          <RNPText variant="labelMedium" style={{ marginLeft: 8, color: m3.onSurface }}>{isRunning ? 'Thinking...' : 'Reasoning'}</RNPText>
        </View>
      </TouchableRipple>
      <View style={{ position: 'absolute', width: '100%', opacity: 0 }} onLayout={(e: any) => setMeasuredHeight(e.nativeEvent.layout.height)}>
        <View style={{ padding: 12 }}><RNPText variant="bodyMedium">{content.trim()}</RNPText></View>
      </View>
      <Animated.View style={[{ overflow: 'hidden', backgroundColor: m3.surface }, bodyStyle]}>
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: m3.outline }}>
          <RNPText variant="bodyMedium" style={{ color: m3.onSurface }}>{content.trim()}</RNPText>
        </View>
      </Animated.View>
    </View>
  );
};

export default function AIChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params.conversationId as string;
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadSettings);
    loadSettings();
    return unsub;
  }, []);

  useEffect(() => { if (conversationId) AIService.getMessages(conversationId).then(setMessages); }, [conversationId]);
  useEffect(() => { checkLimit(); }, [settings]);

  const loadSettings = async () => { const s = await AIService.getSettings(); setSettings(s); };
  const checkLimit = async () => { const allowed = await AIService.checkUsage(settings.provider, settings.model); setIsLimitReached(!allowed); };
  const copyToClipboard = async (text: string) => { await Clipboard.setStringAsync(text); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), content: inputText, sender_id: 'user', created_at: new Date().toISOString() };
    const aiMsgId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = { id: aiMsgId, content: '', sender_id: 'ai', created_at: new Date().toISOString(), is_streaming: true };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newMessages = [aiPlaceholder, userMsg, ...messages];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);
    if (conversationId) AIService.saveMessages(conversationId, newMessages);
    await streamResponse(newMessages, aiMsgId);
  };

  const streamResponse = async (currentMessages: Message[], aiMsgId: string) => {
    const context = currentMessages.slice(1, 11).reverse();
    await AIService.streamChat(context, settings, (chunk) => {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + chunk } : m));
    }, () => {
      setMessages(prev => {
        const final = prev.map(m => m.id === aiMsgId ? { ...m, is_streaming: false } : m);
        if (conversationId) AIService.saveMessages(conversationId, final);
        return final;
      });
      setLoading(false);
      checkLimit();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (conversationId) AIService.getConversation(conversationId).then((c: any) => { if (c?.title === 'New Chat') AIService.generateTitle(currentMessages).then((t: any) => { if (t && t !== 'New Chat') AIService.updateConversationTitle(conversationId, t); }); });
    }, (err: any) => {
      console.error(err);
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + '\n[Error]', is_streaming: false } : m));
      setLoading(false);
      checkLimit();
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <Appbar.Header style={{ backgroundColor: m3.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={<View><RNPText variant="titleMedium" style={{ color: m3.onSurface }}>{settings.provider === 'nebula' ? 'Nebula' : 'Wafer'} AI</RNPText><RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>{AIService.formatModelName(settings.model)}</RNPText></View>} />
        <IconButton icon="cog" iconColor={m3.primary} onPress={() => router.push('/ai-settings')} />
      </Appbar.Header>

      <FlatList ref={flatListRef} data={messages} keyExtractor={i => i.id} renderItem={({ item }) => <MessageItem item={item} onCopy={copyToClipboard} playingId={null} speakingLoading={null} onSpeak={() => {}} />} inverted contentContainerStyle={styles.listContent} />

      <View style={[styles.inputWrapper, { backgroundColor: m3.background }]}>
        {isLimitReached && <View style={[styles.limitPopup, { backgroundColor: m3.errorContainer }]}><RNPText variant="bodyMedium" style={{ color: m3.onErrorContainer }}>Daily limit reached</RNPText></View>}
        <View style={styles.inputBarContainer}>
          <View style={[styles.textBoxWrapper, { backgroundColor: m3.surfaceContainerHighest }]}>
            <TextInput 
              style={[
                styles.textInput, 
                { 
                  backgroundColor: 'transparent',
                  color: m3.onSurface 
                }
              ]} 
              placeholder="Ask anything..." 
              placeholderTextColor={m3.onSurfaceVariant} 
              value={inputText} 
              onChangeText={setInputText} 
              multiline 
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
            disabled={!inputText.trim() || isLimitReached || loading}
            style={[styles.circleButton, { backgroundColor: m3.primary }, (!inputText.trim() || isLimitReached || loading) && { opacity: 0.5 }]}
          >
            <View style={styles.circleButtonContent}>
              {loading ? (
                <RNPActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={inputText.trim().length > 0 ? 'send' : 'mic'} size={20} color="#fff" />
              )}
            </View>
          </TouchableRipple>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10 },
  bubble: { paddingHorizontal: 10, paddingVertical: 2, overflow: 'visible' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 0 },
  thinkContainer: { marginVertical: 8, borderRadius: 8, borderWidth: 1, overflow: 'hidden', width: '100%' },
  systemOutput: { width: '100%', alignItems: 'center', marginVertical: 8, padding: 16, borderRadius: 12 },
  inputWrapper: { paddingHorizontal: 12, paddingBottom: 12 },
  inputRow: { width: '100%' },
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
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
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
  limitPopup: { position: 'absolute', bottom: '100%', left: 16, right: 16, padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center', zIndex: 10 },
});
