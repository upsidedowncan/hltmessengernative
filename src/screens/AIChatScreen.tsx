import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  LayoutAnimation,
  UIManager,
  Image,
  Modal,
  Pressable,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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

import { MainStackParamList } from '../navigation/MainNavigator';
import { useAppTheme } from '../context/FeatureFlagContext';
import { AppBar } from '../components/AppBar';
import { supabase } from '../services/supabase';
import { AIService, AISettings, DEFAULT_AI_SETTINGS } from '../services/AIService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Message = {
  id: string;
  content: string;
  sender_id: 'user' | 'ai' | 'system';
  created_at: string;
  is_streaming?: boolean;
};

const VisualizationEmbed = React.memo(({ content }: { content: string }) => {
  const [height, setHeight] = useState(200);
  const { width } = useWindowDimensions();
  const embedWidth = (width * 0.75) - 24;
  const webviewRef = useRef<WebView>(null);

  const injectedJS = `
    function sendHeight() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: document.body.scrollHeight }));
    }
    if (document.readyState === 'complete') {
      sendHeight();
    } else {
      window.addEventListener('load', sendHeight);
    }
    const observer = new MutationObserver(sendHeight);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  `;

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data === 'number') {
        setHeight(data);
        return;
      }
      if (data.type === 'height') {
        setHeight(data.height);
      }
    } catch (e) {
      const h = Number(event.nativeEvent.data);
      if (!isNaN(h) && h > 0) setHeight(h);
    }
  };

  return (
    <View style={{ height, width: embedWidth, marginVertical: 8, overflow: 'hidden', borderRadius: 8 }}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><script src="https://cdn.tailwindcss.com"></script><style>body { margin: 0; padding: 0; overflow: hidden; background-color: transparent; }</style></head><body>${content}</body></html>`, baseUrl: '' }}
        style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}
        scrollEnabled={false}
        injectedJavaScript={injectedJS}
        onMessage={handleMessage}
        androidLayerType="hardware"
        mixedContentMode="always"
      />
    </View>
  );
});

const ReasoningAccordion = ({ content, isRunning, onToggle }: { content: string, isRunning?: boolean, onToggle?: () => void }) => {
  const [expanded, setExpanded] = useState(isRunning || false);
  const { theme } = useAppTheme();
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    if (isRunning) setExpanded(true);
    else if (isRunning === false) setExpanded(false);
  }, [isRunning]);

  const progress = useDerivedValue(() => {
    return expanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 250 });
  });

  const bodyStyle = useAnimatedStyle(() => ({
    height: measuredHeight * progress.value,
    opacity: progress.value,
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  return (
    <View style={{ marginVertical: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, width: '100%' }}>
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
            setExpanded(!expanded);
            if (onToggle) onToggle();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: theme.cardBackground }}
      >
        <Animated.View style={arrowStyle}>
          <Ionicons name="chevron-forward" size={16} color={theme.tabIconDefault} />
        </Animated.View>
        <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '600', color: theme.tabIconDefault }}>
          {isRunning ? 'Thinking...' : 'Reasoning Process'}
        </Text>
      </TouchableOpacity>
      
      <View 
        style={{ position: 'absolute', width: '100%', opacity: 0, zIndex: -1 }}
        onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
      >
         <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
            <Text style={{ fontSize: 14, lineHeight: 20 }}>{content.trim()}</Text>
        </View>
      </View>

      <Animated.View style={[{ overflow: 'hidden', backgroundColor: theme.cardBackground }, bodyStyle]}>
         <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, opacity: 0.9 }}>
            {content.trim()}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const ImageGenerationBlock = React.memo(({ content }: { content: string }) => {
  const { theme } = useAppTheme();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [params, setParams] = useState<{ prompt: string, model: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    try {
      const parsed = JSON.parse(content);
      if (mounted) setParams(parsed);
      
      if (status === 'idle') {
          generate(parsed.prompt, parsed.model);
      }
    } catch (e) {
      if (mounted) setStatus('error');
    }
    return () => { mounted = false; };
  }, [content]);

  const generate = async (prompt: string, model: string) => {
    setStatus('loading');
    const uri = await AIService.generateImage(prompt, model);
    if (uri) {
      setImageUri(uri);
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  if (status === 'error') {
    return (
      <View style={{ padding: 10, backgroundColor: theme.cardBackground, borderRadius: 8, marginVertical: 8, borderWidth: 1, borderColor: 'red' }}>
        <Text style={{ color: 'red', fontSize: 14 }}>Failed to generate image.</Text>
        <TouchableOpacity onPress={() => params && generate(params.prompt, params.model)}>
           <Text style={{ color: theme.tint, marginTop: 8, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={{ padding: 20, backgroundColor: theme.cardBackground, borderRadius: 8, marginVertical: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={{ color: theme.tabIconDefault, marginTop: 12, fontWeight: '500' }}>Generating image...</Text>
        {params && <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>"{params.prompt}"</Text>}
      </View>
    );
  }

  return (
    <View style={{ marginVertical: 8 }}>
      <Image 
        source={{ uri: imageUri! }} 
        style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: theme.cardBackground }} 
        resizeMode="cover"
      />
    </View>
  );
});

const SyntaxHighlighter = React.memo(({ code }: { code: string }) => {
  const parts: { text: string, color: string, weight?: 'bold' | 'normal' }[] = [];
  let lastIndex = 0;
  
  // Regex for Python syntax highlighting (Strings, Comments, Keywords, Numbers, Booleans, Functions)
  const regex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#.*)|(\b(?:def|class|import|from|return|if|else|elif|for|while|try|except|print|with|as|pass|break|continue|in|is|not|and|or|global|lambda|yield|raise|assert)\b)|(\b\d+(?:\.\d+)?\b)|(\b(?:True|False|None)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\())/g;

  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, match.index), color: '#d4d4d4' });
    }

    const [fullMatch, string, comment, keyword, number, boolean, functionCall] = match;

    let color = '#d4d4d4';
    let weight: 'bold' | 'normal' = 'normal';

    if (string) color = '#ce9178';
    else if (comment) color = '#6a9955';
    else if (keyword) { color = '#c586c0'; weight = 'bold'; }
    else if (number) color = '#b5cea8';
    else if (boolean) { color = '#569cd6'; weight = 'bold'; }
    else if (functionCall) color = '#dcdcaa';

    parts.push({ text: fullMatch, color, weight });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex), color: '#d4d4d4' });
  }

  return (
    <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18 }}>
      {parts.map((part, index) => (
        <Text key={index} style={{ color: part.color, fontWeight: part.weight }}>{part.text}</Text>
      ))}
    </Text>
  );
});

const PythonExecutionBlock = React.memo(({ content, isLastMessage, onExecutionComplete, onToggle }: { content: string, isLastMessage: boolean, onExecutionComplete: (output: string) => void, onToggle?: () => void }) => {
  const { theme } = useAppTheme();
  const [data, setData] = useState<{ code: string, filename?: string, output?: string, status?: 'running' | 'success' | 'error' } | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<{name: string, url: string, type: 'image' | 'file'}[]>([]);
  const [executing, setExecuting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const hasRun = useRef(false);

  const progress = useDerivedValue(() => {
    return expanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 250 });
  });

  const bodyStyle = useAnimatedStyle(() => ({
    height: measuredHeight * progress.value,
    opacity: progress.value,
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  useEffect(() => {
    try {
      // Try parsing as JSON first (expected format from AI tool use)
      const parsed = JSON.parse(content);
      setData(parsed);
    } catch (e) {
      // Fallback: treat content as raw code if not JSON
      setData({ code: content, status: undefined });
    }
  }, [content]);

  const copyCode = async (e: any) => {
    e.stopPropagation();
    if (data?.code) {
      await Clipboard.setStringAsync(data.code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const runCode = async () => {
    if (!data || executing) return;
    setExecuting(true);
    setExpanded(true);
    hasRun.current = true;

    // Optimistic update
    setData(prev => ({ ...prev!, status: 'running', output: undefined }));
    setGeneratedFiles([]);

    try {
      // Get URL from storage
      const storedUrl = await AsyncStorage.getItem('python_backend_url');
      const API_URL = storedUrl || 'https://hltpyexec.vercel.app/api/execute';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.code })
      });

      const result = await response.json();
      
      const isError = result.error || result.status === 'Error';
      const outputText = result.error ? `${result.error}\n${result.output || ''}` : result.output;

      setData(prev => ({
        ...prev!,
        status: isError ? 'error' : 'success',
        output: outputText
      }));

      let fileMsg = '';
      // Handle generated files if any
      if (result.files && Array.isArray(result.files) && result.files.length > 0) {
        let filesToProcess = result.files;
        
        // Filter by expected filename if provided
        if (data.filename) {
             if (typeof result.files[0] === 'string') {
                 filesToProcess = result.files.filter((f: string) => f === data.filename);
             } else {
                 filesToProcess = result.files.filter((f: any) => f.name === data.filename);
             }
        }

        if (filesToProcess.length > 0) {
        // Check if we got a list of filenames (new backend) or file objects (old backend)
        if (typeof filesToProcess[0] === 'string') {
            // New backend: files are filenames, content is in /api/download?file=...
            // We assume the API_URL ends in /execute or /api/execute
            const baseUrl = API_URL.replace(/\/execute\/?$/, '');
            
            const newFiles = filesToProcess.map((filename: string) => ({
                name: filename,
                url: `${baseUrl}/download?file=${encodeURIComponent(filename)}`,
                type: filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' : 'file'
            }));
            setGeneratedFiles(newFiles);
            fileMsg = `\n<GENERATED_FILES>${JSON.stringify(newFiles)}</GENERATED_FILES>`;
        } else {
            // Old backend: files are objects with base64 data
            const uploaded = [];
            const filenames = [];
            for (const file of filesToProcess) {
                try {
                    const blob = await (await fetch(`data:application/octet-stream;base64,${file.data}`)).blob();
                    const path = `python-exec/${Date.now()}_${file.name}`;
                    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, blob);
                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);
                        uploaded.push({
                            name: file.name,
                            url: publicUrl,
                            type: file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' : 'file'
                        });
                        filenames.push(file.name);
                    }
                } catch (e) {
                    console.error('Upload failed', e);
                }
            }
            setGeneratedFiles(uploaded as any);
            if (uploaded.length > 0) {
                fileMsg = `\n<GENERATED_FILES>${JSON.stringify(uploaded)}</GENERATED_FILES>`;
            }
        }
        }
      }

      if (onExecutionComplete) {
          const msg = isError 
            ? `Error: ${outputText}` 
            : `Output:\n${outputText || '(No stdout)'}${fileMsg}`;
          onExecutionComplete(msg);
      }
    } catch (e: any) {
      setData(prev => ({
        ...prev!,
        status: 'error',
        output: `Connection failed: ${e.message}\n\nCheck your backend URL in Settings and ensure the server is running.`
      }));
    } finally {
      setExecuting(false);
      setExpanded(false);
    }
  };

  useEffect(() => {
      if (isLastMessage && data && !hasRun.current && !executing) {
          runCode();
      }
  }, [isLastMessage, data]);

  if (!data) return null;

  return (
    <View style={{ marginVertical: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardBackground, width: '100%' }}>
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => {
            setExpanded(!expanded);
            if (onToggle) onToggle();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: theme.border + '20', borderBottomWidth: expanded ? 1 : 0, borderBottomColor: theme.border }}
      >
        <Animated.View style={arrowStyle}>
            <Ionicons name="chevron-forward" size={14} color={theme.tabIconDefault} style={{ marginRight: 6 }} />
        </Animated.View>
        <Ionicons name="logo-python" size={14} color="#3776AB" style={{ marginRight: 6 }} />
        
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={copyCode} style={{ padding: 4 }}>
                <Ionicons name="copy-outline" size={14} color={theme.tabIconDefault} />
            </TouchableOpacity>

            {(data.status || executing) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {(data.status === 'running' || executing) && <ActivityIndicator size="small" color={theme.tabIconDefault} />}
                    {data.status === 'success' && !executing && <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />}
                    {data.status === 'error' && !executing && <Ionicons name="alert-circle" size={16} color="#F44336" />}
                </View>
            )}
        </View>
      </TouchableOpacity>

      <View style={{ position: 'absolute', width: '100%', opacity: 0, zIndex: -1 }} onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}>
         {/* Hidden view for measurement */}
         <View style={{ padding: 12, backgroundColor: '#1e1e1e', minHeight: 50 }}><Text>{data.code}</Text></View>
      </View>

      <Animated.View style={[{ overflow: 'hidden' }, bodyStyle]}>
       <View style={{ padding: 12, backgroundColor: '#1e1e1e' }}>
        <SyntaxHighlighter code={data.code} />
      </View>
      {data.output ? (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={{ fontSize: 10, color: theme.tabIconDefault, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5 }}>TERMINAL OUTPUT</Text>
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, color: theme.text }}>
                  {data.output}
              </Text>
          </View>
      ) : null}
      {generatedFiles.length > 0 && (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: theme.border, gap: 8 }}>
              <Text style={{ fontSize: 10, color: theme.tabIconDefault, fontWeight: '700', letterSpacing: 0.5 }}>GENERATED FILES</Text>
              <View style={{ gap: 8 }}>
                  {generatedFiles.map((file, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        onPress={() => Linking.openURL(file.url)} 
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.border + '40', padding: 8, borderRadius: 8 }}
                      >
                          {file.type === 'image' ? (
                              <Image source={{ uri: file.url }} style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: '#333', marginRight: 12 }} />
                          ) : (
                              <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                  <Ionicons name="document-text" size={24} color={theme.text} />
                              </View>
                          )}
                          <Text style={{ color: theme.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{file.name}</Text>
                          <Ionicons name="download-outline" size={20} color={theme.tabIconDefault} style={{ marginRight: 4 }} />
                      </TouchableOpacity>
                  ))}
              </View>
          </View>
      )}
      </Animated.View>
    </View>
  );
});

const MessageItem = React.memo(({ 
  item, 
  onOpenFullScreen, 
  onCopyToClipboard, 
  onSpeak, 
  onPythonExecutionComplete,
  playingMessageId, 
  isSpeakingLoading,
  isLastMessage,
  onContentChange
}: { 
  item: Message, 
  onOpenFullScreen: (html: string) => void,
  onCopyToClipboard: (text: string) => void,
  onSpeak: (msg: Message) => void,
  onPythonExecutionComplete: (output: string) => void,
  playingMessageId: string | null,
  isSpeakingLoading: string | null,
  isLastMessage: boolean,
  onContentChange?: () => void
}) => {
  const { theme, isDarkMode } = useAppTheme();
  const isMe = item.sender_id === 'user';
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const markdownStyles = {
    body: {
      color: isMe ? '#fff' : theme.text, 
      fontSize: 16, 
      lineHeight: 22,
      padding: 0,
      margin: 0,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 0,
    },
    code_inline: {
      backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : (isDarkMode ? '#3a3a3c' : '#e5e5ea'),
      borderRadius: 4,
      paddingHorizontal: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fence: {
      backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : (isDarkMode ? '#1c1c1e' : '#f2f2f7'),
      borderColor: isMe ? 'rgba(255,255,255,0.2)' : theme.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 8,
      marginTop: 4,
      marginBottom: 4,
    },
  };

  const markdownRules = {
    image: (node: any, children: any, parent: any, styles: any) => {
      return (
        <Image
          key={node.key}
          style={{ width: '100%', height: 200, borderRadius: 8, marginVertical: 4 }}
          source={{ uri: node.attributes.src }}
          resizeMode="cover"
        />
      );
    },
  };

  const parseContent = (content: string) => {
    let processedContent = content;
    // Handle QWQ missing start tag
    if (!processedContent.includes('<think>') && processedContent.includes('</think>')) {
        processedContent = '<think>' + processedContent;
    }

    const regex = /(<(?:VISUALIZATION_EMBED|VISUALIZATION_FULL|think|IMAGE_GEN|PYTHON_EXEC)>[\s\S]*?<\/(?:VISUALIZATION_EMBED|VISUALIZATION_FULL|think|IMAGE_GEN|PYTHON_EXEC)>)/g;
    const parts = processedContent.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('<VISUALIZATION_EMBED>')) {
        return { type: 'embed', content: part.replace(/<\/?VISUALIZATION_EMBED>/g, ''), key: index };
      }
      if (part.startsWith('<VISUALIZATION_FULL>')) {
        return { type: 'full', content: part.replace(/<\/?VISUALIZATION_FULL>/g, ''), key: index };
      }
      if (part.startsWith('<think>') && part.endsWith('</think>')) {
        return { type: 'think', content: part.replace(/<\/?think>/g, ''), key: index, isRunning: false };
      }
      if (part.startsWith('<IMAGE_GEN>')) {
        return { type: 'image_gen', content: part.replace(/<\/?IMAGE_GEN>/g, ''), key: index };
      }
      if (part.startsWith('<PYTHON_EXEC>')) {
        return { type: 'python_exec', content: part.replace(/<\/?PYTHON_EXEC>/g, ''), key: index };
      }
      
      // Handle incomplete think tag (streaming)
      if (part.includes('<think>')) {
          const split = part.split('<think>');
          const pre = split[0];
          const think = split.slice(1).join('<think>');
          return [
              pre.trim() ? { type: 'text', content: pre, key: `${index}_pre` } : null,
              { type: 'think', content: think, key: `${index}_think`, isRunning: true }
          ];
      }

      return part.trim() ? { type: 'text', content: part, key: index } : null;
    }).flat().filter(Boolean) as { type: 'embed' | 'full' | 'text' | 'think' | 'image_gen' | 'python_exec', content: string, key: string | number, isRunning?: boolean }[];
  };

  const parts = parseContent(item.content);

  if (item.sender_id === 'system') {
      const fileTagRegex = /<GENERATED_FILES>(.*?)<\/GENERATED_FILES>/s;
      const match = item.content.match(fileTagRegex);
      let files: {name: string, url: string, type: 'image' | 'file'}[] = [];
      let textContent = item.content;

      if (match) {
          try {
              files = JSON.parse(match[1]);
              textContent = item.content.replace(match[0], '').trim();
          } catch (e) {
              console.error('Failed to parse generated files', e);
          }
      }

      return (
          <View style={{ width: '100%', alignItems: 'center', marginVertical: 8 }}>
              <Text style={{ color: theme.tabIconDefault, fontSize: 12, fontWeight: '500' }}>SYSTEM OUTPUT</Text>
              <View style={{ marginTop: 2, paddingHorizontal: 16 }}>
                  <Text style={{ color: theme.tabIconDefault, fontSize: 12, textAlign: 'center' }}>
                      {textContent.split(/(@cf\/[\w\-\.\/]+|https?:\/\/[^\s]+)/g).map((part, index) => {
                          if (part.startsWith('@cf/')) {
                              return (
                                  <Text key={index} style={{ color: theme.text, fontWeight: '700' }}>
                                      {part}
                                  </Text>
                              );
                          }
                          if (part.match(/^https?:\/\//)) {
                              return (
                                  <Text 
                                      key={index} 
                                      style={{ color: theme.tint, textDecorationLine: 'underline' }}
                                      onPress={() => Linking.openURL(part)}
                                  >
                                      {part}
                                  </Text>
                              );
                          }
                          return <Text key={index}>{part}</Text>;
                      })}
                  </Text>
              </View>
              {files.length > 0 && (
                  <View style={{ marginTop: 8, width: '100%', maxWidth: 300, gap: 8 }}>
                      {files.map((file, idx) => (
                          <TouchableOpacity 
                            key={idx} 
                            onPress={() => Linking.openURL(file.url)} 
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.border + '40', padding: 8, borderRadius: 8 }}
                          >
                              {file.type === 'image' ? (
                                  <Image source={{ uri: file.url }} style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: '#333', marginRight: 12 }} />
                              ) : (
                                  <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                      <Ionicons name="document-text" size={24} color={theme.text} />
                                  </View>
                              )}
                              <Text style={{ color: theme.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{file.name}</Text>
                              <Ionicons name="download-outline" size={20} color={theme.tabIconDefault} style={{ marginRight: 4 }} />
                          </TouchableOpacity>
                      ))}
                  </View>
              )}
          </View>
      );
  }

  return (
    <View style={{ marginBottom: 12, width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      {parts.map((part) => (
        <React.Fragment key={part.key}>
          {part.type === 'embed' ? (
            <VisualizationEmbed content={part.content} />
          ) : (
            <TouchableOpacity 
              activeOpacity={0.8}
              onLongPress={() => onCopyToClipboard(item.content)}
              style={{ maxWidth: '75%', marginBottom: 2 }}
            >
              <Animated.View style={[
                  styles.bubble, 
                  animatedStyle,
                  { 
                      backgroundColor: isMe ? theme.tint : (isDarkMode ? '#262626' : '#E5E5EA'),
                      borderTopLeftRadius: !isMe ? 4 : 20,
                      borderTopRightRadius: isMe ? 4 : 20,
                      borderBottomLeftRadius: 20,
                      borderBottomRightRadius: 20,
                  }
              ]}>
                {part.type === 'text' && (
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {part.content}
                  </Markdown>
                )}
                {part.type === 'full' && (
                  <Pressable 
                    onPress={() => onOpenFullScreen(part.content)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? theme.border : theme.cardBackground, 
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 12, 
                      marginVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      borderWidth: 1,
                      borderColor: theme.border
                    })}
                  >
                    <Ionicons name="browsers-outline" size={16} color={theme.tint} style={{ marginRight: 6 }} />
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>Open Interactive Visualization</Text>
                  </Pressable>
                )}
                {part.type === 'think' && (
                  <ReasoningAccordion content={part.content} isRunning={part.isRunning} onToggle={onContentChange} />
                )}
                {part.type === 'image_gen' && (
                  <ImageGenerationBlock content={part.content} />
                )}
                {part.type === 'python_exec' && (
                  <PythonExecutionBlock 
                    content={part.content} 
                    isLastMessage={isLastMessage}
                    onExecutionComplete={onPythonExecutionComplete}
                    onToggle={onContentChange}
                  />
                )}
              </Animated.View>
            </TouchableOpacity>
          )}
        </React.Fragment>
      ))}
      {item.is_streaming && (
          <View style={{ marginTop: 4, maxWidth: '75%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
            <View style={[styles.bubble, { backgroundColor: isMe ? theme.tint : (isDarkMode ? '#262626' : '#E5E5EA'), borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 }]}>
              <ActivityIndicator size="small" color={isMe ? '#fff' : theme.tabIconDefault} />
            </View>
          </View>
      )}
      
      <View style={[styles.metadataContainer, { justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }]}>
         <Text style={[styles.timeText, { color: theme.tabIconDefault }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
         </Text>
         {!item.is_streaming && (
           <TouchableOpacity 
             onPress={() => onSpeak(item)}
             style={{ marginLeft: 8, padding: 2 }}
             disabled={isSpeakingLoading === item.id}
           >
             {isSpeakingLoading === item.id ? (
               <ActivityIndicator size={10} color={theme.tabIconDefault} />
             ) : (
               <Ionicons 
                 name={playingMessageId === item.id ? "stop-circle" : "volume-high-outline"} 
                 size={14} 
                 color={playingMessageId === item.id ? theme.tint : theme.tabIconDefault} 
               />
             )}
           </TouchableOpacity>
         )}
      </View>
    </View>
  );
});

export const AIChatScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'AIChat'>>();
  const { theme, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const conversationId = route.params?.conversationId;
  const [fullScreenHtml, setFullScreenHtml] = useState<string | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isSpeakingLoading, setIsSpeakingLoading] = useState<string | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const focusUnsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    loadSettings();
    return focusUnsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (conversationId) {
      AIService.getMessages(conversationId).then(setMessages);
    }
  }, [conversationId]);

  useEffect(() => {
    checkLimit();
  }, [settings]);

  const loadSettings = async () => {
    const s = await AIService.getSettings();
    setSettings(s);
  };

  const checkLimit = async () => {
    const allowed = await AIService.checkUsage(settings.provider, settings.model);
    setIsLimitReached(!allowed);
  };

  const handlePythonExecutionComplete = async (output: string) => {
      // Add system message with output
      const outputMsg: Message = {
          id: Date.now().toString(),
          content: output,
          sender_id: 'system',
          created_at: new Date().toISOString(),
      };

      const newMessages = [outputMsg, ...messages];
      setMessages(newMessages);
      if (conversationId) AIService.saveMessages(conversationId, newMessages);

      // Trigger AI response
      const aiMsgId = (Date.now() + 1).toString();
      const aiMsgPlaceholder: Message = {
          id: aiMsgId,
          content: '',
          sender_id: 'ai',
          created_at: new Date().toISOString(),
          is_streaming: true,
      };

      setMessages([aiMsgPlaceholder, ...newMessages]);
      await streamResponse([aiMsgPlaceholder, ...newMessages], aiMsgId);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      content: inputText,
      sender_id: 'user',
      created_at: new Date().toISOString(),
    };

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsgPlaceholder: Message = {
      id: aiMsgId,
      content: '',
      sender_id: 'ai',
      created_at: new Date().toISOString(),
      is_streaming: true,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newMessages = [aiMsgPlaceholder, userMsg, ...messages];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);
    
    if (conversationId) AIService.saveMessages(conversationId, newMessages);

    await streamResponse(newMessages, aiMsgId);
  };

  const streamResponse = async (currentMessages: Message[], aiMsgId: string) => {
    // Prepare context for AI (last 10 messages)
    const contextMessages = currentMessages.slice(1, 11).reverse();

    await AIService.streamChat(
      contextMessages,
      settings,
      (chunk) => {
        setMessages(prev => {
          const updated = prev.map(m => {
          if (m.id === aiMsgId) {
            return { ...m, content: m.content + chunk };
          }
          return m;
          });
          return updated;
        });
      },
      () => {
        setMessages(prev => {
            const final = prev.map(m => m.id === aiMsgId ? { ...m, is_streaming: false } : m);
            if (conversationId) AIService.saveMessages(conversationId, final);
            return final; 
        });
        setLoading(false);
        checkLimit();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (conversationId) {
           AIService.getConversation(conversationId).then(conv => {
               if (conv && conv.title === 'New Chat') {
                   AIService.generateTitle(currentMessages).then(title => {
                       if (title && title !== 'New Chat') AIService.updateConversationTitle(conversationId, title);
                   });
               }
           });
        }
      },
      (err) => {
        console.error(err);
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + '\n[Error: Failed to generate response]', is_streaming: false } : m));
        setLoading(false);
        checkLimit();
      }
    );
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSpeak = async (message: Message) => {
    if (playingMessageId === message.id) {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      setPlayingMessageId(null);
      return;
    }

    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setPlayingMessageId(null);
    }

    setIsSpeakingLoading(message.id);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const uri = await AIService.generateSpeech(message.content);
      if (uri) {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        setSound(newSound);
        setPlayingMessageId(message.id);
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingMessageId(null);
            setSound(null);
          }
        });
        await newSound.playAsync();
      }
    } catch (e) {
      console.error("Speech error", e);
    } finally {
      setIsSpeakingLoading(null);
    }
  };

  const renderHeaderTitle = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ alignItems: Platform.OS === 'ios' ? 'center' : 'flex-start' }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
          {settings.provider === 'nebula' ? 'Nebula' : 'Wafer'} AI
        </Text>
        <Text style={{ color: theme.tabIconDefault, fontSize: 11 }}>
          {AIService.formatModelName(settings.model)}
        </Text>
      </View>
    </View>
  );

  const renderHeaderRight = () => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('AISettings' as any)}
      style={{ marginRight: 10 }}
    >
      <Ionicons name="settings-outline" size={24} color={theme.tint} />
    </TouchableOpacity>
  );

  const headerHeight = (Platform.OS === 'ios' ? 44 : 56) + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar 
        centerComponent={renderHeaderTitle()}
        rightComponent={renderHeaderRight()}
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
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <MessageItem 
              item={item} 
              onOpenFullScreen={setFullScreenHtml} 
              onCopyToClipboard={copyToClipboard}
              onSpeak={handleSpeak}
              onPythonExecutionComplete={handlePythonExecutionComplete}
              playingMessageId={playingMessageId}
              isSpeakingLoading={isSpeakingLoading}
              isLastMessage={index === 0}
              onContentChange={() => {
                  // Scroll to the item to keep the title in view when expanding/collapsing
                  // viewPosition: 1 aligns the item to the top of the viewport (in inverted list context)
                  setTimeout(() => {
                      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 1 });
                  }, 100);
              }}
            />
          )}
          inverted
          contentContainerStyle={styles.listContent}
        />

        <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 6) }]}>
          {isLimitReached && (
            <View style={[styles.limitPopup, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
               <Ionicons name="alert-circle" size={20} color={theme.tint} style={{ marginRight: 8 }} />
               <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>Daily limit reached for this model.</Text>
            </View>
          )}
          <View style={styles.innerContainer}>
              <TextInput 
                  editable={!isLimitReached}
                  style={[
                      styles.input, 
                      { 
                          backgroundColor: isDarkMode ? '#1c1c1e' : '#fff',
                          color: isLimitReached ? theme.tabIconDefault : theme.text,
                          opacity: isLimitReached ? 0.5 : 1
                      }
                  ]} 
                  placeholder="Ask anything..." 
                  placeholderTextColor={theme.tabIconDefault} 
                  value={inputText} 
                  onChangeText={setInputText} 
                  multiline 
                  selectionColor={theme.tint}
              />
              
              <TouchableOpacity 
                onPress={handleSend} 
                disabled={(loading && !inputText) || isLimitReached} 
                style={[styles.sendButton, { backgroundColor: theme.tint, opacity: ((!inputText && !loading) || isLimitReached) ? 0.6 : 1 }]}
              >
                  {loading && !inputText ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color="#fff" />
                  )}
              </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!fullScreenHtml}
        animationType="slide"
        onRequestClose={() => setFullScreenHtml(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity 
            onPress={() => setFullScreenHtml(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {fullScreenHtml && (
            <WebView
              originWhitelist={['*']}
              source={{ html: (() => {
                  const content = fullScreenHtml;
                  if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
                      if (content.includes('name="viewport"')) return content;
                      if (content.match(/<head>/i)) return content.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width, initial-scale=1.0">');
                      if (content.match(/<html>/i)) return content.replace(/<html>/i, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>');
                      return content;
                  }
                  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;">${content}</body></html>`;
              })() }}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, overflow: 'visible' },
  metadataContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  timeText: { fontSize: 10, opacity: 0.7 },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5856D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  
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
  limitPopup: {
    position: 'absolute',
    bottom: '100%',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 10,
  },
});