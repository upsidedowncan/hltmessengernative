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
  useColorScheme,
  Image as RNImage,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Alert,
  Modal,
  Dimensions,
  DeviceEventEmitter,
  Keyboard,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import ImageView from 'react-native-image-viewing';
import InCallManager from 'react-native-incall-manager';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useFeatureFlags } from '@/contexts/feature-flag-context';
import { useCall } from '@/contexts/call-context';
import { callService } from '@/services/call-service';
import { AppBar } from '@/components/app-bar';
import { DeepLinkUserWidget } from '@/components/deep-link-user-widget';
import { Colors } from '@/constants/colors';
import { useSendNotification } from '@/hooks/use-send-notification';

import ChatBubble from '@/components/chat/ChatBubble';
import ChatInput from '@/components/chat/ChatInput';
import { Message, Attachment } from '@/components/chat/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Remove RouteProp types as they are not needed for expo-router

type Attachment = {
  type: 'image' | 'file' | 'audio';
  url: string;
  name?: string;
  size?: number;
  duration?: number; // Add duration for audio
};

type Reactions = Record<string, string[]>;

type Message = {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read_at: string | null;
  attachments: Attachment[];
  is_edited: boolean;
  reactions?: Reactions | null;
};

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

export default function SingleChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendId = params.friendId as string;
  const friendName = params.friendName as string;
  const friendAvatar = params.friendAvatar as string | undefined;
  const isLockedParam = params.isLocked as string;

  const { user, profile } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const { isEnabled } = useFeatureFlags();
  const { setIsCallInProgress } = useCall() as any;
  const { sendNotification } = useSendNotification();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isChatLocked, setIsChatLocked] = useState(isLockedParam === 'true');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showLockOverlay, setShowLockOverlay] = useState(false);

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

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

  const [isNear, setIsNear] = useState(false);

  const [isAudioMode, setIsAudioMode] = useState(false);

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

  const unlockChat = async () => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to unlock this chat',
    });

    if (result.success) {
      setShowLockOverlay(false);
    }
  };

  useEffect(() => {
    const checkBiometricAndLock = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setBiometricAvailable(compatible);
      
      const locked = await AsyncStorage.getItem(`locked_chat_${friendId}`);
      if (locked === 'true') {
        setIsChatLocked(true);
        setShowLockOverlay(true);
      }
    };
    checkBiometricAndLock();
    
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
    if (selectedMessage) {
      setSelectedMessage(null);
      setIsMenuClosing(false);
    }
  }, [messages.length]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (isAttachmentOpen) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsAttachmentOpen(false);
        }
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

  const updateMessageReactions = (messageId: string, reactions: Reactions) => {
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, reactions } : m)));
  };

  const toggleReaction = async (message: Message, emoji: string) => {
    if (!user || message.id.startsWith('opt_')) return;

    const existing = (message.reactions || {}) as Reactions;
    const current = new Set(existing[emoji] || []);
    const hasReacted = current.has(user.id);

    if (hasReacted) {
      current.delete(user.id);
    } else {
      current.add(user.id);
    }

    const updated: Reactions = { ...existing };
    if (current.size === 0) {
      delete updated[emoji];
    } else {
      updated[emoji] = Array.from(current);
    }

    updateMessageReactions(message.id, updated);

    try {
      const { error } = await supabase
        .from('messages')
        .update({ reactions: updated })
        .eq('id', message.id);
      if (error) throw error;
    } catch (error) {
      updateMessageReactions(message.id, existing);
    }
  };

  // NEW: Unified send function
  const handleSend = async (text: string) => {
    // If text is provided, use it. Otherwise fall back to state (though state should be cleared by parent)
    // But with new flow, parent state 'inputText' is just for sync, the triggered action comes with 'text'.
    // If the component calls handleSend(text), we use that text. 
    
    // We should allow empty text if there are attachments
    const contentToSend = text || '';
    if ((!contentToSend.trim() && attachments.length === 0) || !user) return;
    setSending(true);

    const optimisticMsg: Message = {
      id: `opt_${Date.now()}_${Math.random()}`,
      sender_id: user.id,
      receiver_id: friendId,
      content: contentToSend,
      attachments: attachments,
      created_at: new Date().toISOString(),
      read_at: null,
      is_edited: false,
      reactions: {}
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages(prev => [optimisticMsg, ...prev]);
    // Clear parent state to sync back to empty
    setInputText('');
    setAttachments([]);

    try {
      const { error } = await supabase.rpc('rpc_send_message', {
        p_sender_id: user.id,
        p_receiver_id: friendId,
        p_content: contentToSend,
        p_attachments: attachments,
      });
      if (error) throw error;

      // Trigger push notification
      sendNotification({
        userId: friendId,
        title: profile?.full_name || 'New Message',
        body: optimisticMsg.content || 'Sent an attachment',
        screen: 'SingleChat',
        params: { friendId: user.id, friendName: profile?.full_name || 'Friend' }
      }).catch(err => console.error('Notification failed', err));

    } catch (error: any) {
      console.error("Send failed", error);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  // Attachment handling
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Check file size (limit to 10MB)
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        if (fileInfo.exists && (fileInfo as any).size > 10 * 1024 * 1024) {
          Alert.alert('File too large', 'Please select an image under 10MB');
          return;
        }
        
        const uploaded = await uploadFile(asset.uri, 'image');
        if (uploaded) {
          await sendMessageWithAttachment([uploaded]);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Check file size (limit to 50MB)
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        if (fileInfo.exists && (fileInfo as any).size > 50 * 1024 * 1024) {
          Alert.alert('File too large', 'Please select a file under 50MB');
          return;
        }
        
        const uploaded = await uploadFile(asset.uri, 'file', asset.name, (fileInfo as any).size);
        if (uploaded) {
          await sendMessageWithAttachment([uploaded]);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  // Upload file to Supabase Storage
  const uploadFile = async (uri: string, type: 'image' | 'file' | 'audio', name?: string, size?: number, duration?: number): Promise<Attachment | null> => {
    try {
      // Create a unique filename
      const ext = uri.split('.').pop() || (type === 'image' ? 'jpg' : type === 'audio' ? 'm4a' : 'bin');
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const path = `${user?.id}/${filename}`;

      // Read file as base64 or array buffer
      const fileData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, bytes, {
          contentType: type === 'image' ? 'image/jpeg' : type === 'audio' ? 'audio/m4a' : 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);

      return {
        type,
        url: publicUrl,
        name: name || filename,
        size,
        duration,
      };
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload file. Please try again.');
      return null;
    }
  };

  // Send message with attachment
  const sendMessageWithAttachment = async (atts: Attachment[]) => {
    if (!user || atts.length === 0) return;
    setSending(true);

    const optimisticMsg: Message = {
      id: `opt_${Date.now()}_${Math.random()}`,
      sender_id: user.id,
      receiver_id: friendId,
      content: '',
      attachments: atts,
      created_at: new Date().toISOString(),
      read_at: null,
      is_edited: false,
      reactions: {}
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages(prev => [optimisticMsg, ...prev]);

    try {
      const { error } = await supabase.rpc('rpc_send_message', {
        p_sender_id: user.id,
        p_receiver_id: friendId,
        p_content: '',
        p_attachments: atts,
      });
      if (error) throw error;

      // Trigger push notification
      sendNotification({
        userId: friendId,
        title: profile?.full_name || 'New Message',
        body: atts[0].type === 'audio' ? '🎤 Voice message' : '📎 Attachment',
        screen: 'SingleChat',
        params: { friendId: user.id, friendName: profile?.full_name || 'Friend' }
      }).catch(err => console.error('Notification failed', err));

    } catch (error: any) {
       console.error("Send failed", error);
       setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  };

  const startRecording = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setPlayingAudioId(null);
        InCallManager.stop();
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopAndSendRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); 
      setRecording(null);

      if (uri) {
          const { sound, status } = await recording.createNewLoadedSoundAsync();
          const duration = (status as any).durationMillis || 0;
          
          // Simplified: upload directly without checking size via FileSystem
          const uploaded = await uploadFile(uri, 'audio', `Voice Message ${new Date().toLocaleTimeString()}`, 0, duration);
          if (uploaded) {
              await sendMessageWithAttachment([uploaded]);
          }
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const playAudio = async (url: string, id: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        InCallManager.stop();
        if (playingAudioId === id) {
          setPlayingAudioId(null);
          return;
        }
      }

      InCallManager.start({media: 'audio'});
      InCallManager.setForceSpeakerphoneOn(true);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );
      
      setSound(newSound);
      setPlayingAudioId(id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if ((status as any).didJustFinish) {
          setPlayingAudioId(null);
          InCallManager.stop();
        }
      });
    } catch (error) {
      console.error('Failed to play audio', error);
    }
  };

  // Attachment actions
  const downloadFile = async (url: string, name: string) => {
    try {
      // Open share dialog for files
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(url, {
          mimeType: '*/*',
          dialogTitle: name || 'Download File',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Failed to download file');
    }
  };

  const copyFile = async (url: string) => {
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'File URL copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
    }
  };



  // Attachment picker modal
  const AttachmentPicker = () => {
    if (!isAttachmentOpen) return null;

    return (
      <>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAttachmentOpen(false)}
        />
        <View style={[styles.attachmentMenu, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.attachmentOption} onPress={pickImage}>
            <View style={[styles.optionIcon, { backgroundColor: theme.tint }]}>
              <MaterialCommunityIcons name="image" size={28} color="#fff" />
            </View>
            <Text style={[styles.optionText, { color: theme.text }]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption} onPress={pickDocument}>
            <View style={[styles.optionIcon, { backgroundColor: '#5856D6' }]}>
              <MaterialCommunityIcons name="file-document" size={28} color="#fff" />
            </View>
            <Text style={[styles.optionText, { color: theme.text }]}>File</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // Message menu
  const MessageMenu = () => {
    if (!selectedMessage) return null;

    const isMyMessage = selectedMessage.sender_id === user?.id;
    const menuWidth = 220;

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: menuScale.value }],
      transformOrigin: [menuOnLeft ? 0 : menuWidth, 0, 0],
      opacity: menuOpacity.value,
    }));

    const backdropStyle = useAnimatedStyle(() => ({
      opacity: menuAnimation.value * 0.4,
    }));

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View 
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', position: 'absolute' }, backdropStyle]} 
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
          <View style={styles.reactionMenuRow}>
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={`react-${emoji}`}
                style={styles.reactionMenuButton}
                onPress={() => {
                  toggleReaction(selectedMessage, emoji);
                  closeMenu();
                }}
              >
                <Text style={styles.reactionMenuEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
          {!!selectedMessage.content && (
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => { Clipboard.setStringAsync(selectedMessage.content); closeMenu(); }}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>Copy</Text>
              <MaterialCommunityIcons name="content-copy" size={20} color={theme.text} />
            </TouchableOpacity>
          )}

          {isMyMessage && (
            <>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => { 
                  supabase.from('messages').delete().eq('id', selectedMessage.id).then(() => {
                    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                  });
                  closeMenu(); 
                }}
              >
                <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete</Text>
                <MaterialCommunityIcons name="delete" size={20} color="#FF3B30" />
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

  const renderHeaderRight = () => {
    const nativeEnabled = isEnabled('ENABLE_CALLING') && callService.isSupported();
    
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {nativeEnabled && (
          <TouchableOpacity 
            onPress={() => {
              setIsCallInProgress(true);
              router.push({
                pathname: '/call/[id]',
                params: { id: friendId, friendId, friendName, friendAvatar: friendAvatar || '', isIncoming: 'false', isVideo: 'false' }
              });
            }}
            style={{ marginRight: 15 }}
          >
            <MaterialCommunityIcons name="phone-outline" size={24} color={theme.tint} />
          </TouchableOpacity>
        )}
        {nativeEnabled && (
          <TouchableOpacity 
            onPress={() => {
              setIsCallInProgress(true);
              router.push({
                pathname: '/call/[id]',
                params: { id: friendId, friendId, friendName, friendAvatar: friendAvatar || '', isIncoming: 'false', isVideo: 'true' }
              });
            }}
            style={{ marginRight: 10 }}
          >
            <MaterialCommunityIcons name="video-outline" size={26} color={theme.tint} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={() => {
            router.push({
              pathname: '/chat-info',
              params: { friendId, friendName, friendAvatar: friendAvatar || '' }
            });
          }}
          style={{ marginRight: 8 }}
        >
          <MaterialCommunityIcons name="information-outline" size={26} color={theme.tint} />
        </TouchableOpacity>
      </View>
    );
  };

  const headerHeight = 44 + insets.top;

  // Render lock overlay - should cover everything when locked
  if (isChatLocked && showLockOverlay) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <AppBar 
          centerComponent={renderHeaderTitle()}
          rightComponent={renderHeaderRight()}
          isNative={true}
        />
        <View style={styles.lockOverlay}>
          <View style={[styles.lockContent, { backgroundColor: theme.background }]}>
            <View style={styles.lockIconContainer}>
              <MaterialCommunityIcons name="lock" size={48} color={theme.tint} />
            </View>
            <Text style={[styles.lockTitle, { color: theme.text }]}>Chat Locked</Text>
            <Text style={[styles.lockSubtitle, { color: theme.tabIconDefault }]}>
              This chat is locked. Authenticate to view messages.
            </Text>
            <TouchableOpacity 
              style={[styles.unlockButton, { backgroundColor: theme.tint }]}
              onPress={unlockChat}
            >
              <MaterialCommunityIcons name="fingerprint" size={24} color="#fff" />
              <Text style={styles.unlockButtonText}>Unlock with Biometrics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar 
        centerComponent={renderHeaderTitle()}
        rightComponent={renderHeaderRight()}
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
          renderItem={({ item, index }) => {
            const isMe = item.sender_id === user?.id;
            const newerMessage = messages[index - 1];
            const isSameSender = newerMessage && newerMessage.sender_id === item.sender_id;
            const TIME_THRESHOLD = 60 * 1000;
            const isWithinTime = newerMessage && (new Date(newerMessage.created_at).getTime() - new Date(item.created_at).getTime() < TIME_THRESHOLD);
            const isLastInGroup = !isSameSender || !isWithinTime;

            return (
              <ChatBubble
                message={item}
                isMe={isMe}
                isLastInGroup={isLastInGroup}
                onLongPress={(m, x, y) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openMenu(m, x, y);
                }}
                onAttachmentPress={(att) => {
                    if (att.type === 'image') {
                        setViewerImages([{ uri: att.url }]);
                        setViewerIndex(0);
                        setViewerVisible(true);
                    } else if (att.type === 'audio') {
                        playAudio(att.url, att.url);
                    } else {
                        Alert.alert('File', att.name || 'File', [
                            { text: 'Download', onPress: () => downloadFile(att.url, att.name || 'file') },
                            { text: 'Copy Link', onPress: () => copyFile(att.url) },
                            { text: 'Cancel', style: 'cancel' }
                        ]);
                    }
                }}
              />
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

        <AttachmentPicker />
        
        <ChatInput
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            onAttach={() => setIsAttachmentOpen(!isAttachmentOpen)}
            isRecording={isRecording}
            onRecordPressIn={startRecording}
            onRecordPressOut={stopAndSendRecording}
            isLoading={sending}
        />
      </KeyboardAvoidingView>

      <MessageMenu />
      
      <ImageView
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  attachmentMenu: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 24,
    zIndex: 101,
    borderTopWidth: 1,
  },
  attachmentOption: {
    alignItems: 'center',
    gap: 8,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  customMenu: {
    borderRadius: 14,
    overflow: 'hidden',
    width: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 1000,
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
  reactionMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reactionMenuButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  reactionMenuEmoji: {
    fontSize: 20,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  // Lock overlay styles
  lockOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 250,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
