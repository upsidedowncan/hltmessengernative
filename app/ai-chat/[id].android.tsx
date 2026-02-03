import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TextInput, FlatList, Platform, Dimensions, LayoutAnimation, UIManager, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useDerivedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Appbar, IconButton, Text as RNPText, Surface, TouchableRipple, ActivityIndicator as RNPActivityIndicator } from 'react-native-paper';
import { useTheme } from '@/contexts/theme-context';
import { AIService, AISettings, DEFAULT_AI_SETTINGS } from '@/services/ai-service';
import { PythonExecutionService, PythonExecutionResult } from '@/services/python-execution-service';
import ChatBubble from '@/components/chat-bubble';
import PythonCodeBlock from '@/components/python-code-block';
import PythonExecutionResultComponent from '@/components/python-execution-result';
import SystemOutputBlock from '@/components/system-output-block';
import ImageGenBlock from '@/components/image-gen-block';
import VisualizationBlock from '@/components/visualization-block';

const { width } = Dimensions.get('window');
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Message = { 
  id: string; 
  content: string; 
  sender_id: 'user' | 'ai' | 'system'; 
  created_at: string; 
  is_streaming?: boolean;
  executionResults?: PythonExecutionResult[];
};

const parseContent = (content: string) => {
  if (content.includes(' ') && content.includes(' ')) {
    const match = content.match(/ ([\s\S]*?)<\/think>/);
    return match ? { hasThink: true, think: match[1].trim(), text: content.replace(/ [\s\S]*?<\/think>/g, '').trim() } : { hasThink: false, text: content };
  }
  return { hasThink: false, text: content };
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

// Component to render message content with code blocks
const MessageContent = ({ 
  content, 
  messageId,
  isMe, 
  m3, 
  onCopy,
  executionResults,
  onExecutionComplete 
}: { 
  content: string; 
  messageId: string;
  isMe: boolean;
  m3: any;
  onCopy: (text: string) => void;
  executionResults?: PythonExecutionResult[];
  onExecutionComplete?: (result: PythonExecutionResult) => void;
}) => {
  const blocks = PythonExecutionService.parseContentBlocks(content);
  
  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'code' || block.type === 'python_exec') {
          return (
            <PythonCodeBlock
              key={`${messageId}-code-${index}`}
              code={block.content}
              language={block.type === 'code' ? block.language : 'python'}
              filename={block.filename}
              onExecute={onExecutionComplete}
              showExecuteButton={true}
            />
          );
        } else if (block.type === 'image_gen') {
          return (
            <ImageGenBlock
              key={`${messageId}-image-${index}`}
              jsonContent={block.content}
            />
          );
        } else if (block.type === 'visualization_embed' || block.type === 'visualization_full') {
          return (
            <VisualizationBlock
              key={`${messageId}-viz-${index}`}
              htmlContent={block.content}
              type={block.type === 'visualization_full' ? 'full' : 'embed'}
              messageId={`${messageId}-${index}`}
            />
          );
        } else {
          // Regular text content
          return (
            <TouchableRipple key={`${messageId}-text-${index}`} onLongPress={() => onCopy(block.content)}>
              <View style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <Surface
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainerHighest,
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                    }
                  ]}
                  elevation={0}
                >
                  <Markdown
                    style={{
                      body: {
                        color: isMe ? m3.onPrimaryContainer : m3.onSurface,
                        fontSize: 15,
                        marginVertical: 0,
                        paddingVertical: 0,
                        lineHeight: 18,
                      },
                      paragraph: { marginVertical: 0, paddingVertical: 0, lineHeight: 18 },
                      link: { color: isMe ? m3.onPrimaryContainer : m3.primary },
                      strong: { fontWeight: 'bold' },
                      em: { fontStyle: 'italic' },
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
                      bullet_list: { marginTop: 0 },
                      ordered_list: { marginTop: 0 },
                      list_item: { flexDirection: 'row', alignItems: 'flex-start' },
                      bullet_list_icon: { marginRight: 8, marginTop: 2 },
                      ordered_list_icon: { marginRight: 8, marginTop: 0 },
                    }}
                  >
                    {block.content}
                  </Markdown>
                </Surface>
              </View>
            </TouchableRipple>
          );
        }
      })}
      
      {/* Display execution results */}
      {executionResults && executionResults.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {executionResults.map((result, index) => (
            <PythonExecutionResultComponent
              key={`${messageId}-result-${index}`}
              result={result}
              onClose={() => {}}
            />
          ))}
        </View>
      )}
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadSettings);
    loadSettings();
    return unsub;
  }, []);

  useEffect(() => { if (conversationId) AIService.getMessages(conversationId).then(setMessages); }, [conversationId]);
  useEffect(() => { checkLimit(); }, [settings]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadSettings = async () => { const s = await AIService.getSettings(); setSettings(s); };
  const checkLimit = async () => { const allowed = await AIService.checkUsage(settings.provider, settings.model); setIsLimitReached(!allowed); };
  const copyToClipboard = async (text: string) => { await Clipboard.setStringAsync(text); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };

  const handleExecutionComplete = useCallback(async (messageId: string, result: PythonExecutionResult) => {
    // First, save the execution result to the message
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          executionResults: [...(m.executionResults || []), result]
        };
      }
      return m;
    }));

    // Then, send the execution result back to the AI as a system message
    const outputMessage = result.error 
      ? `[PYTHON EXECUTION ERROR]\n${result.error}`
      : `[PYTHON EXECUTION OUTPUT]\n${result.output}`;
    
    if (result.files.length > 0) {
      const filesList = result.files.join(', ');
      const filesMessage = `\n[FILES CREATED]\n${filesList}`;
      await sendSystemMessage(outputMessage + filesMessage);
    } else {
      await sendSystemMessage(outputMessage);
    }
  }, [messages, settings]);

  const sendSystemMessage = async (content: string) => {
    const systemMsg: Message = { 
      id: `system_${Date.now()}`, 
      content: content, 
      sender_id: 'system', 
      created_at: new Date().toISOString() 
    };
    
    // Add system message and get AI response
    const aiMsgId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = { 
      id: aiMsgId, 
      content: '', 
      sender_id: 'ai', 
      created_at: new Date().toISOString(), 
      is_streaming: true 
    };
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newMessages = [aiPlaceholder, systemMsg, ...messages];
    setMessages(newMessages);
    setLoading(true);
    
    if (conversationId) AIService.saveMessages(conversationId, newMessages);
    await streamResponse(newMessages, aiMsgId);
  };

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

  const headerHeight = (Platform.OS === 'ios' ? 64 : 56) + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <Appbar.Header style={{ backgroundColor: m3.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={<View><RNPText variant="titleMedium" style={{ color: m3.onSurface }}>{settings.provider === 'nebula' ? 'Nebula' : 'Wafer'} AI</RNPText><RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>{AIService.formatModelName(settings.model)}</RNPText></View>} />
        <IconButton icon="cog" iconColor={m3.primary} onPress={() => router.push('/ai-settings')} />
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
          keyExtractor={i => i.id} 
          renderItem={({ item, index }) => {
            const isMe = item.sender_id === 'user';
            const newerMessage = messages[index - 1];
            const isSameSender = newerMessage && newerMessage.sender_id === item.sender_id;
            const TIME_THRESHOLD = 60 * 1000;
            const isWithinTime = newerMessage && (new Date(newerMessage.created_at).getTime() - new Date(item.created_at).getTime() < TIME_THRESHOLD);
            const isLastInGroup = !isSameSender || !isWithinTime;

            // Handle system messages
            if (item.sender_id === 'system') {
              return (
                <SystemOutputBlock content={item.content} />
              );
            }

            const { hasThink, think, text } = parseContent(item.content);
            
            return (
              <View style={{ marginBottom: isLastInGroup ? 12 : 2 }}>
                {hasThink && think && (
                  <ReasoningAccordion content={think} isRunning={item.is_streaming} m3={m3} />
                )}
                <MessageContent
                  content={text}
                  messageId={item.id}
                  isMe={isMe}
                  m3={m3}
                  onCopy={copyToClipboard}
                  executionResults={item.executionResults}
                  onExecutionComplete={(result) => handleExecutionComplete(item.id, result)}
                />
                {isLastInGroup && (
                  <View style={[styles.meta, { justifyContent: isMe ? 'flex-end' : 'flex-start', marginRight: isMe ? 10 : 0 }]}>
                    <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</RNPText>
                  </View>
                )}
              </View>
            );
          }} 
          inverted 
          contentContainerStyle={[styles.listContent, { paddingBottom: 80 + keyboardHeight }]} 
        />

        <SafeAreaView edges={["bottom"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.inputWrapper, { backgroundColor: m3.background, paddingBottom: 12 + keyboardHeight }]}
            keyboardVerticalOffset={headerHeight}
          >
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10 },
  bubble: { paddingHorizontal: 8, paddingVertical: 0, overflow: 'visible', maxWidth: '75%' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 0 },
  thinkContainer: { marginVertical: 8, borderRadius: 8, borderWidth: 1, overflow: 'hidden', width: '100%' },
  inputWrapper: { paddingHorizontal: 12, paddingBottom: 12 },
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
