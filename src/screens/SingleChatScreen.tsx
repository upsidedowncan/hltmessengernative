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
  ScrollView,
  LayoutAnimation,
  UIManager,
  Alert,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/MainNavigator';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Keyboard } from 'react-native';
import { Audio } from 'expo-av';
import { useAppTheme, useFeatureFlags } from '../context/FeatureFlagContext';
import { useCall } from '../context/CallContext';
import { callService } from '../services/CallService';
import ImageView from 'react-native-image-viewing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Modal, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Button, TextField, Tile, AppBar, Puller, PullerRef } from '../components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SingleChatScreenRouteProp = RouteProp<MainStackParamList, 'SingleChat'>;

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

export const SingleChatScreen = () => {
  const route = useRoute<SingleChatScreenRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { friendId, friendName } = route.params;
  const { user } = useAuth();
  const { theme, isDarkMode } = useAppTheme();
  const { isEnabled } = useFeatureFlags();
  const { setIsCallInProgress } = useCall() as any;
  const insets = useSafeAreaInsets();
  const pullerRef = useRef<PullerRef>(null);
  
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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<{ position: number; duration: number } | null>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [imageActionLoading, setImageActionLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (selectedMessage) {
      setSelectedMessage(null);
      setIsMenuClosing(false);
    }
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (isAttachmentOpen) {
           pullerRef.current?.collapse();
        }
      }
    );
    return () => {
      keyboardDidShowListener.remove();
    };
  }, [isAttachmentOpen]);

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

  const nativeEnabled = isEnabled('ENABLE_CALLING') && callService.isSupported();

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
        p_content: optimisticMsg.content,
        p_attachments: optimisticMsg.attachments,
      });
      if (error) throw error;
    } catch (error: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (uri: string, type: 'image' | 'file' | 'audio', name?: string, size?: number, duration?: number) => {
      if (size && size > 10 * 1024 * 1024) {
          Alert.alert('File too large', 'Max 10MB per file.');
          return;
      }
      try {
          const ext = uri.split('.').pop();
          const fileName = `${Date.now()}.${ext}`;
          const filePath = `${user?.id}/${fileName}`;
          const formData = new FormData();
          
          let mimeType = 'application/octet-stream';
          if (type === 'image') mimeType = 'image/jpeg';
          else if (type === 'audio') mimeType = 'audio/m4a';

          formData.append('file', { uri, name: fileName, type: mimeType } as any);
          
          const { error } = await supabase.storage.from('chat-attachments').upload(filePath, formData, { contentType: mimeType });
          if (error) throw error;
          
          const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
          
          const attachment: Attachment = { type, url: publicUrl, name, size, duration };
          
          if (type === 'audio') {
             return attachment;
          }

          setAttachments(prev => [...prev, attachment]);
          return attachment;
      } catch (error: any) {
          console.error('Upload failed', error.message);
          return null;
      }
  };

  const handleAttach = () => {
    Keyboard.dismiss();
    pullerRef.current?.toggle();
  };

  const pickImage = async () => {
    Keyboard.dismiss();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'We need access to your photos to send them.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      pullerRef.current?.collapse();
      await uploadFile(result.assets[0].uri, 'image');
    }
  };

  const pickDocument = async () => {
    Keyboard.dismiss();
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    
    if (!result.canceled) {
      pullerRef.current?.collapse();
      await uploadFile(result.assets[0].uri, 'file', result.assets[0].name, result.assets[0].size);
    }
  };

  const sendMessageWithAttachment = async (atts: Attachment[]) => {
      if (!user) return;
      
      const optimisticMsg: Message = {
        id: `opt_${Date.now()}_${Math.random()}`, 
        sender_id: user.id,
        receiver_id: friendId,
        content: '',
        attachments: atts,
        created_at: new Date().toISOString(),
        read_at: null,
        is_edited: false
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
    } catch (error: any) {
       console.error("Send failed", error);
       setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  };

  const startRecording = async () => {
    try {
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
        if (playingAudioId === id) {
          setPlayingAudioId(null);
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url }, 
          { shouldPlay: true }
      );
      setSound(newSound);
      setPlayingAudioId(id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
            setPlaybackStatus({ position: status.positionMillis, duration: status.durationMillis || 0 });
            if (status.didJustFinish) {
              setPlayingAudioId(null);
              setSound(null);
              setPlaybackStatus(null);
            }
        }
      });
    } catch (error) {
      console.error('Failed to play audio', error);
    }
  };

  const handleImagePress = (imageUrl: string) => {
    setViewerImages([{ uri: imageUrl }]);
    setViewerIndex(0);
    setViewerVisible(true);
  };

  const handleDownload = async (uri: string) => {
    try {
      setImageActionLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need access to your photos to save images.');
        setImageActionLoading(false);
        return;
      }

      const fileName = uri.split('/').pop() || 'image.jpg';
      const fileUri = FileSystem.documentDirectory + fileName;
      const downloadResumable = FileSystem.createDownloadResumable(uri, fileUri);
      const result = await downloadResumable.downloadAsync();

      if (result) {
        await MediaLibrary.saveToLibraryAsync(result.uri);
        Alert.alert('Success', 'Image saved to gallery.');
      }
    } catch (e) {
      console.error('Download error', e);
      Alert.alert('Error', 'Failed to save image.');
    } finally {
      setImageActionLoading(false);
    }
  };

  const handleShare = async (uri: string) => {
    try {
      setImageActionLoading(true);
      const fileName = uri.split('/').pop() || 'image.jpg';
      const fileUri = FileSystem.cacheDirectory + fileName;
      const downloadResumable = FileSystem.createDownloadResumable(uri, fileUri);
      const result = await downloadResumable.downloadAsync();

      if (result) {
        await Sharing.shareAsync(result.uri);
      }
    } catch (e) {
      console.error('Share error', e);
      Alert.alert('Error', 'Failed to share image.');
    } finally {
      setImageActionLoading(false);
    }
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
    isSelected,
    isMenuClosing
  }: { 
    item: Message; 
    index: number; 
    onLongPress: (m: Message, x: number, y: number) => void;
    isSelected: boolean;
    isMenuClosing: boolean;
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

    const scale = useSharedValue(1);

    useEffect(() => {
      const active = isSelected || isMenuClosing;
      scale.value = withSpring(active ? 1.05 : 1, { damping: 55, stiffness: 520 });
    }, [isSelected, isMenuClosing]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      shadowOpacity: interpolate(scale.value, [1, 1.05], [0, 0.3]),
      shadowRadius: interpolate(scale.value, [1, 1.05], [0, 15]),
      shadowOffset: { width: 0, height: 10 },
      shadowColor: '#000',
      elevation: interpolate(scale.value, [1, 1.05], [0, 10]),
      zIndex: (isSelected || isMenuClosing) ? 1000 : 1,
    }));

    return (
      <View style={{ marginBottom: isLastInGroup ? 12 : 2, zIndex: (isSelected || isMenuClosing) ? 1000 : 1 }}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onLongPress={(e) => onLongPress(item, e.nativeEvent.pageX, e.nativeEvent.pageY)}
          style={[styles.messageRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}
        >
          <Animated.View style={[
              styles.bubble, 
              animatedStyle,
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
                                  cachePolicy="disk"
                                  transition={200}
                                />
                            </TouchableOpacity>
                        ) : att.type === 'audio' ? (
                            <View key={idx} style={{ minWidth: 220 }}>
                                <View style={[styles.audioContainer, { backgroundColor: 'transparent' }]}>
                                    <TouchableOpacity 
                                        onPress={() => playAudio(att.url, item.id + idx)} 
                                        style={[styles.playButton, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}
                                    >
                                        <Ionicons 
                                            name={playingAudioId === (item.id + idx) ? "pause" : "play"} 
                                            size={16} 
                                            color={isMe ? '#fff' : theme.text} 
                                        />
                                    </TouchableOpacity>
                                    <View style={styles.audioWaveform}>
                                        <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)', borderRadius: 1 }} />
                                        <View style={{ 
                                            height: 2, 
                                            backgroundColor: isMe ? '#fff' : theme.tint, 
                                            width: (playingAudioId === (item.id + idx) && playbackStatus?.duration) 
                                                ? `${(playbackStatus.position / playbackStatus.duration) * 100}%` 
                                                : '0%', 
                                            borderRadius: 1 
                                        }} />
                                    </View>
                                    <Text style={{ color: isMe ? '#fff' : theme.text, fontSize: 11, fontWeight: '600', minWidth: 26, textAlign: 'right' }}>
                                        {att.duration ? Math.round(att.duration / 1000) + 's' : ''}
                                    </Text>
                                </View>
                            </View>
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
          </Animated.View>
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

  const MessageContextMenu = ({ 
    visible, 
    message, 
    onClose, 
    onCopy, 
    onDelete,
    position,
    onUnmount
  }: { 
    visible: boolean; 
    message: Message | null; 
    onClose: () => void;
    onCopy: (t: string) => void;
    onDelete: (id: string) => void;
    position: { x: number, y: number };
    onUnmount: () => void;
  }) => {
    const [render, setRender] = useState(visible);
    const [activeMessage, setActiveMessage] = useState<Message | null>(message);
    const scale = useSharedValue(0);
    const bgOpacity = useSharedValue(0);

    useEffect(() => {
      if (visible) {
        setActiveMessage(message);
        setRender(true);
        scale.value = withSpring(1, { damping: 55, stiffness: 520 });
        bgOpacity.value = withTiming(1, { duration: 200 });
      } else {
        bgOpacity.value = withTiming(0, { duration: 200 });
        scale.value = withSpring(0, { damping: 55, stiffness: 520 }, (finished) => {
          if (finished) {
            runOnJS(setRender)(false);
            runOnJS(setActiveMessage)(null);
            runOnJS(onUnmount)();
          }
        });
      }
    }, [visible]);

    const isLeft = position.x < SCREEN_WIDTH / 2;
    const menuWidth = Platform.OS === 'ios' ? 250 : 200;

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      transformOrigin: [isLeft ? 0 : menuWidth, 0, 0],
      opacity: interpolate(scale.value, [0, 1], [0, 1]),
    }));

    const bgStyle = useAnimatedStyle(() => ({
      backgroundColor: `rgba(0,0,0,${interpolate(bgOpacity.value, [0, 1], [0, 0.15])})`,
    }));

    if (!render || !activeMessage) return null;

    const isMyMessage = activeMessage.sender_id === user?.id;

    return (
      <Modal transparent visible={render} animationType="none" onRequestClose={onClose}>
        <Animated.View style={[styles.modalOverlay, bgStyle, { justifyContent: 'flex-start', alignItems: 'flex-start' }]}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={onClose}
          />
          <Animated.View style={[
            Platform.OS === 'ios' ? styles.iosMenu : styles.androidMenu, 
            animatedStyle,
            { 
              backgroundColor: isDarkMode ? '#1c1c1e' : '#fff',
              position: 'absolute',
              top: Math.min(position.y + 20, Dimensions.get('window').height - 150),
              left: isLeft ? Math.max(10, position.x) : Math.min(SCREEN_WIDTH - menuWidth - 10, position.x - menuWidth),
              zIndex: 100,
            }
          ]}>
            {!!activeMessage.content && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { onCopy(activeMessage.content); onClose(); }}
              >
                <Text style={[styles.menuItemText, { color: theme.text }]}>Copy</Text>
                <Ionicons name="copy-outline" size={Platform.OS === 'ios' ? 20 : 24} color={theme.text} />
              </TouchableOpacity>
            )}

            {isMyMessage && (
              <>
                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => { onDelete(activeMessage.id); onClose(); }}
                >
                  <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete</Text>
                  <Ionicons name="trash-outline" size={Platform.OS === 'ios' ? 20 : 24} color="#FF3B30" />
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  const renderHeaderTitle = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {connectionStatus !== 'connected' && (
        <ActivityIndicator size="small" color={theme.tint} style={{ marginRight: 8 }} />
      )}
      <View style={{ alignItems: Platform.OS === 'ios' ? 'center' : 'flex-start' }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
          {connectionStatus === 'connected' ? friendName : 'Connecting...'}
        </Text>
        {connectionStatus === 'connected' && (
           <Text style={{ color: theme.tabIconDefault, fontSize: 11 }}>Online</Text>
        )}
      </View>
    </View>
  );

  const headerHeight = (Platform.OS === 'ios' ? 44 : 56) + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar 
        centerComponent={renderHeaderTitle()}
        rightComponent={
          (nativeEnabled) ? (
            <TouchableOpacity 
              onPress={() => {
                setIsCallInProgress(true);
                navigation.navigate('Call', { friendId, friendName, isIncoming: false });
              }}
              style={{ marginRight: 8 }}
            >
              <Ionicons name="call-outline" size={24} color={theme.tint} />
            </TouchableOpacity>
          ) : undefined
        }
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
              isSelected={selectedMessage?.id === item.id}
              isMenuClosing={isMenuClosing && selectedMessage?.id === item.id}
              onLongPress={(m, x, y) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setMenuPosition({ x, y });
                setIsMenuClosing(false);
                setSelectedMessage(m);
              }}
            />
          )}
          inverted
          contentContainerStyle={styles.listContent}
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

        <Puller 
          ref={pullerRef}
          onStateChange={setIsAttachmentOpen}
          baseContent={
            <View style={{ backgroundColor: theme.background }}>
              {attachments.length > 0 && (
                  <ScrollView horizontal style={styles.previewContainer} showsHorizontalScrollIndicator={false}>
                      {attachments.map((att, i) => (
                          <View key={i} style={styles.previewItem}>
                              {att.type === 'image' ? (
                                  <Image source={{ uri: att.url }} style={{ width: 60, height: 60, borderRadius: 8 }} />
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

              <View style={[styles.innerContainer, { paddingVertical: 8, alignItems: 'center' }]}>
                  <TouchableOpacity onPress={handleAttach} style={styles.iconButton}>
                      <Ionicons name={isAttachmentOpen ? "close" : "add"} size={32} color={theme.tint} />
                  </TouchableOpacity>
                  
                  <TextInput 
                      style={[
                          styles.input, 
                          { 
                              backgroundColor: isDarkMode ? '#1c1c1e' : '#fff',
                              color: theme.text,
                              paddingVertical: Platform.OS === 'ios' ? 10 : 8,
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
                      <TouchableOpacity onPress={handleSend} disabled={sending} style={[styles.sendButton, { backgroundColor: theme.tint }]}>
                          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
                      </TouchableOpacity>
                  ) : (
                      <TouchableOpacity 
                        onPressIn={startRecording} 
                        onPressOut={stopAndSendRecording}
                        style={[styles.sendButton, { backgroundColor: isRecording ? '#FF3B30' : theme.tabIconDefault }]}
                      >
                        <Ionicons name="mic" size={20} color="#fff" />
                      </TouchableOpacity>
                  )}
              </View>
            </View>
          }
          expandedContent={
            <View style={[styles.attachmentMenu, { borderTopColor: theme.border }]}>
                <TouchableOpacity style={styles.attachmentOption} onPress={pickImage}>
                    <View style={[styles.optionIcon, { backgroundColor: '#007AFF' }]}>
                        <Ionicons name="image" size={24} color="#fff" />
                    </View>
                    <Text style={[styles.optionText, { color: theme.text }]}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachmentOption} onPress={pickDocument}>
                    <View style={[styles.optionIcon, { backgroundColor: '#5856D6' }]}>
                        <Ionicons name="document-text" size={24} color="#fff" />
                    </View>
                    <Text style={[styles.optionText, { color: theme.text }]}>Document</Text>
                </TouchableOpacity>
            </View>
          }
        />
      </KeyboardAvoidingView>

      <ImageView
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        FooterComponent={({ imageIndex }) => (
          <View style={[styles.viewerFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {imageActionLoading ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.footerButtonText}>Processing...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.footerButton} 
                  onPress={() => handleShare(viewerImages[imageIndex].uri)}
                >
                  <Ionicons name="share-outline" size={24} color="#fff" />
                  <Text style={styles.footerButtonText}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.footerButton} 
                  onPress={() => handleDownload(viewerImages[imageIndex].uri)}
                >
                  <Ionicons name="download-outline" size={24} color="#fff" />
                  <Text style={styles.footerButtonText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      />

      <MessageContextMenu 
        visible={!!selectedMessage && !isMenuClosing}
        message={selectedMessage}
        position={menuPosition}
        onClose={() => setIsMenuClosing(true)}
        onUnmount={() => {
          setSelectedMessage(null);
          setIsMenuClosing(false);
        }}
        onCopy={copyToClipboard}
        onDelete={deleteMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, overflow: 'visible' },
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
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
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
  
  audioContainer: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 18, gap: 8 },
  playButton: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  audioWaveform: { flex: 1, height: 16, justifyContent: 'center' },

  viewerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
  },
  footerButton: {
    alignItems: 'center',
    gap: 4,
  },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    flex: 1,
  },
  footerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  menuContainer: {
    width: '100%',
    alignItems: 'center',
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
  androidMenu: {
    borderRadius: 4,
    overflow: 'hidden',
    width: 200,
    elevation: 8,
    alignSelf: 'center',
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
});
