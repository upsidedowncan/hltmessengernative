import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
  UIManager,
  LayoutAnimation,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  Text,
} from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { useSecurity } from '@/contexts/security-context';
import { AIService, AISettings } from '@/services/ai-service';
import { supabase } from '@/services/supabase';
import Animated, { FadeIn } from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Message = {
  id: string;
  content: string;
  sender_id: 'user' | 'ai';
  created_at: string;
  is_streaming?: boolean;
};

const buildUnlockSystemPrompt = (userData: {
  username: string;
  fullName: string;
  friendCount: number;
  friends: Array<{ username: string; full_name: string }>;
}): string => {
  const friendsList = userData.friends
    .map((f, i) => `${i + 1}. ${f.full_name} (@${f.username})`)
    .join('\n');

  return `You are a security verification AI. Verify user identity by checking their answers against the EXACT data provided.

ACTUAL USER DATA (verify against this):
- Username: ${userData.username}
- Full Name: ${userData.fullName}
- Total Friends: ${userData.friendCount}
- Friends List:
${friendsList || 'No friends yet'}

YOUR JOB:
Ask 3-4 security questions about this data. When the user answers, verify EXACTLY against the data above.
- Username must match exactly (case-insensitive)
- Full name should match (allow minor variations)
- Friends must appear in the list above
- Friend count must match

SPECIAL RULE:
- If the user's username is hlt or HLT and they type "unlock", immediately verify them.

QUESTIONS TO ASK:
1. "What's your username?"
2. "What's your full name?"
3. "Name 2-3 of your friends"
4. "How many friends do you have in total?"

VERIFICATION:
- Only accept answers that match the actual data provided above
- If answers are correct: Say "Great! Your identity matches our records." then end with IDENTITY_VERIFIED on its own line
- If answers are wrong: Say "Those answers don't match our records." then end with IDENTITY_REJECTED on its own line
- If unsure: Ask clarifying questions, then decide

The phrase IDENTITY_VERIFIED or IDENTITY_REJECTED must appear at the very end of your response, on its own line.`;
};

const MessageItem = ({ item, theme }: { item: Message; theme: any }) => {
  const isMe = item.sender_id === 'user';

  // Hide the control phrases from display
  const displayContent = item.content
    .replace(/\n*IDENTITY_VERIFIED\n*/g, '')
    .replace(/\n*IDENTITY_REJECTED\n*/g, '')
    .replace(/\n*NEED_MORE_INFO\n*/g, '')
    .trim();

  if (!displayContent && !item.is_streaming) return null;

  return (
    <View style={{ marginBottom: 12, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      {displayContent && (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? theme.tint : theme.cardBackground,
              borderTopLeftRadius: !isMe ? 4 : 20,
              borderTopRightRadius: isMe ? 4 : 20,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              maxWidth: '85%',
            },
          ]}
        >
          <Markdown
            style={{
              body: {
                color: isMe ? '#FFFFFF' : theme.text,
                fontSize: 16,
                marginVertical: 0,
                paddingVertical: 0,
                lineHeight: 22,
                fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System',
              },
              link: { color: isMe ? '#FFFFFF' : theme.tint },
              strong: { fontWeight: '600' },
              em: { fontStyle: 'italic' },
              code: {
                backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              },
              pre: {
                backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                padding: 8,
                borderRadius: 8,
              },
              blockquote: {
                borderLeftWidth: 3,
                borderLeftColor: isMe ? '#FFFFFF' : theme.tint,
                paddingLeft: 8,
                marginLeft: 0,
                color: isMe ? 'rgba(255,255,255,0.8)' : theme.tabIconDefault,
              },
              paragraph: { marginVertical: 0, paddingVertical: 0, lineHeight: 22 },
              bullet_list: { marginTop: 0, marginVertical: 0, paddingVertical: 0, lineHeight: 22 },
              ordered_list: { marginTop: 0, marginVertical: 0, paddingVertical: 0, lineHeight: 22 },
              list_item: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 0, paddingVertical: 0 },
              bullet_list_icon: { marginRight: 6, marginTop: 0 },
              ordered_list_icon: { marginRight: 6, marginTop: 0 },
            }}
          >
            {displayContent}
          </Markdown>
        </View>
      )}
      {item.is_streaming && (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: theme.cardBackground,
              borderRadius: 20,
            },
          ]}
        >
          <Text style={{ color: theme.tabIconDefault, fontSize: 16 }}>...</Text>
        </View>
      )}
      <View style={[styles.meta, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
        <Text style={{ color: theme.tabIconDefault, fontSize: 12, fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System' }}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

interface UnlockVerificationChatProps {
  onClose: () => void;
}

export default function UnlockVerificationChat({ onClose }: UnlockVerificationChatProps) {
  const { theme, isDarkMode } = useTheme();
  const { setBlocked } = useSecurity();

  const [messages, setMessages] = useState<Message[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);
  const flatListRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const getUserId = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch {
      return null;
    }
  };

  const getUserData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return null;

      const userId = session.user.id;
      
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        console.error('Failed to fetch profile:', profileError);
        return null;
      }

      // Get friends list
      const { data: friendships, error: friendsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('Failed to fetch friendships:', friendsError);
        return {
          username: profile.username,
          fullName: profile.full_name,
          friendCount: 0,
          friends: []
        };
      }

      // Get friend details
      const friendIds = friendships?.map(f => f.friend_id) || [];
      let friends: Array<{ username: string; full_name: string }> = [];

      if (friendIds.length > 0) {
        const { data: friendProfiles, error: friendDetailsError } = await supabase
          .from('profiles')
          .select('username, full_name')
          .in('id', friendIds);

        if (!friendDetailsError && friendProfiles) {
          friends = friendProfiles;
        }
      }

      return {
        username: profile.username,
        fullName: profile.full_name,
        friendCount: friendIds.length,
        friends
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const extractControlPhrase = (content: string): string | null => {
    if (content.includes('IDENTITY_VERIFIED')) return 'IDENTITY_VERIFIED';
    if (content.includes('IDENTITY_REJECTED')) return 'IDENTITY_REJECTED';
    if (content.includes('NEED_MORE_INFO')) return 'NEED_MORE_INFO';
    return null;
  };

  const handleUnlock = useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('account_lockouts')
        .update({ released_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('released_at', null);

      if (error) {
        console.error('Failed to remove lockout:', error);
        return;
      }

      setShowSuccessModal(true);
      setBlocked(false, null);
    } catch (error) {
      console.error('Unlock error:', error);
    }
  }, [setBlocked]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || loading || isVerified) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender_id: 'user',
      content: inputText.trim(),
      created_at: new Date().toISOString(),
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const aiMsgId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = {
      id: aiMsgId,
      sender_id: 'ai',
      content: '',
      created_at: new Date().toISOString(),
      is_streaming: true
    };

    const newMessages = [aiPlaceholder, userMsg, ...messages];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    let aiResponse = '';

    try {
      // Fetch user data for verification
      const userData = await getUserData();
      if (!userData) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "Unable to retrieve your account information. Please try again.", is_streaming: false }
              : m
          )
        );
        setLoading(false);
        return;
      }

      const systemPrompt = buildUnlockSystemPrompt(userData);

      const settings: AISettings = {
        model: 'gpt-oss-120b',
        temperature: 0.3,
        max_tokens: 600,
        systemPrompt: systemPrompt,
        provider: 'wafer',
      };

      const contextMessages = newMessages.slice(1).reverse().map((m) => ({
        sender_id: m.sender_id,
        content: m.content,
      }));

      await AIService.streamChat(
        contextMessages,
        settings,
        (chunk) => {
          aiResponse += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: aiResponse, is_streaming: true }
                : m
            )
          );
        },
        () => {
          const controlPhrase = extractControlPhrase(aiResponse);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, is_streaming: false } : m
            )
          );

          if (controlPhrase === 'IDENTITY_VERIFIED') {
            setIsVerified(true);
            handleUnlock();
          } else if (controlPhrase === 'IDENTITY_REJECTED') {
            Alert.alert(
              'Verification Failed',
              'Your answers did not match our records. Please wait for the lock to expire.',
              [{ text: 'OK' }]
            );
          } else if (controlPhrase === 'NEED_MORE_INFO') {
            // AI should have asked more questions in the response already
            setQuestionCount(prev => prev + 1);
          }

          setLoading(false);
        },
        (error) => {
          console.error('Unlock chat error:', error);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: "I apologize, but I'm having technical difficulties. Please try again.", is_streaming: false }
                : m
            )
          );
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('Stream error:', error);
      setLoading(false);
    }
  }, [inputText, loading, isVerified, messages, questionCount, handleUnlock]);

  // Generate initial greeting when component mounts
  useEffect(() => {
    const generateInitialGreeting = async () => {
      if (initialized) return;
      
      const aiMsgId = 'greeting-' + Date.now().toString();
      const greetingPlaceholder: Message = {
        id: aiMsgId,
        sender_id: 'ai',
        content: '',
        created_at: new Date().toISOString(),
        is_streaming: true
      };

      setMessages([greetingPlaceholder]);
      setInitialized(true);

      let aiResponse = '';

      try {
        // Fetch actual user data
        const userData = await getUserData();
        if (!userData) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: "Unable to retrieve your account information. Please try again later.", is_streaming: false }
                : m
            )
          );
          return;
        }

        const systemPrompt = buildUnlockSystemPrompt(userData);

        const settings: AISettings = {
          model: 'gpt-oss-120b',
          temperature: 0.3,
          max_tokens: 600,
          systemPrompt: systemPrompt,
          provider: 'wafer',
        };

        await AIService.streamChat(
          [],
          settings,
          (chunk) => {
            aiResponse += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, content: aiResponse, is_streaming: true }
                  : m
              )
            );
          },
          () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, is_streaming: false } : m
              )
            );
          },
          (error) => {
            console.error('Initial greeting error:', error);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, content: "I apologize, but I'm having technical difficulties. Please try again.", is_streaming: false }
                  : m
              )
            );
          }
        );
      } catch (error) {
        console.error('Greeting generation error:', error);
      }
    };

    generateInitialGreeting();
  }, []);

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages]);

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

  return (
    <Host style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={[styles.headerContent, { backgroundColor: theme.background }]}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={theme.tint} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Identity Verification
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
              Question {questionCount} of 5
            </Text>
          </View>
          {isVerified && (
            <Ionicons name="checkmark-circle" size={28} color="#4ade80" />
          )}
          {!isVerified && <View style={styles.placeholder} />}
        </View>
      </SafeAreaView>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageItem item={item} theme={theme} />}
        inverted
        contentContainerStyle={[styles.listContent, { paddingBottom: 80 + keyboardHeight }]}
      />

      <SafeAreaView edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.inputWrapper, { backgroundColor: theme.background }]}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputBarContainer}>
            <View style={[styles.textBoxWrapper, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: theme.text,
                  },
                ]}
                placeholder="Type your answer..."
                placeholderTextColor={theme.tabIconDefault}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!loading && !isVerified}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || loading || isVerified}
              style={[
                styles.sendButton,
                (!inputText.trim() || loading || isVerified) && { opacity: 0.5 },
              ]}
            >
              {loading ? (
                <View style={[styles.spinner, { borderColor: theme.tint }]} />
              ) : (
                <Ionicons name="send" size={20} color={theme.tint} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {showSuccessModal && (
        <Modal transparent visible animationType="fade">
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Animated.View
              entering={FadeIn}
              style={[styles.successContainer, { backgroundColor: theme.cardBackground }]}
            >
              <View style={styles.checkmarkContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#4ade80" />
              </View>
              <Text style={[styles.successTitle, { color: theme.text }]}>
                Identity Verified!
              </Text>
              <Text style={[styles.successSubtitle, { color: theme.tabIconDefault }]}>
                Thank you for confirming your identity. Your account has been unlocked.
              </Text>
              <View style={styles.buttonWrapper}>
                <Button
                  onPress={() => {
                    setShowSuccessModal(false);
                    onClose();
                  }}
                  variant="glassProminent"
                >
                  Continue to App
                </Button>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System',
    marginTop: 2,
  },
  placeholder: {
    width: 36,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'visible',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  inputWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  textBoxWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    marginRight: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '0deg' }],
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContainer: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    width: '85%',
    marginHorizontal: 20,
  },
  checkmarkContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System',
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'System',
    lineHeight: 20,
  },
  buttonWrapper: {
    width: '100%',
  },
});
