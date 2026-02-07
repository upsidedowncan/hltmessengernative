import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { Message, Attachment } from './types';
import * as Haptics from 'expo-haptics';

interface ChatBubbleProps {
  message: Message;
  isMe: boolean;
  isLastInGroup: boolean;
  onLongPress: (message: Message, x: number, y: number) => void;
  onAttachmentPress: (attachment: Attachment) => void;
}

export default function ChatBubble({
  message,
  isMe,
  isLastInGroup,
  onLongPress,
  onAttachmentPress,
}: ChatBubbleProps) {
  const { theme } = useTheme();

  const handleLongPress = (event: any) => {
    Haptics.selectionAsync(); // Android also supports this
    const { nativeEvent } = event;
    onLongPress(message, nativeEvent.pageX, nativeEvent.pageY);
  };

  const bubbleStyle: ViewStyle = {
    backgroundColor: isMe ? theme.tint : theme.cardBackground,
    borderTopLeftRadius: !isMe && !isLastInGroup ? 4 : 16,
    borderTopRightRadius: isMe && !isLastInGroup ? 4 : 16,
    borderBottomLeftRadius: !isMe ? 4 : 16,
    borderBottomRightRadius: isMe ? 4 : 16,
    elevation: 1, // Subtle elevation
  };

  const textColor = isMe ? '#fff' : theme.text;
  const secondaryTextColor = isMe ? 'rgba(255,255,255,0.7)' : theme.tabIconDefault;

  const reactionEntries = Object.entries(message.reactions || {}).filter(
    ([, users]) => Array.isArray(users) && users.length > 0
  );

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      layout={Layout.springify()}
      style={[
        styles.container,
        { justifyContent: isMe ? 'flex-end' : 'flex-start' },
        isLastInGroup ? { marginBottom: 12 } : { marginBottom: 2 },
      ]}
    >
      <Pressable
        onLongPress={handleLongPress}
        android_ripple={{ color: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
        style={[styles.bubbleContainer, bubbleStyle]}
      >
        {/* Attachments */}
        {message.attachments?.map((att, index) => (
          <AttachmentItem
            key={index}
            attachment={att}
            onPress={() => onAttachmentPress(att)}
            isMe={isMe}
            theme={theme}
          />
        ))}

        {/* Text Content */}
        {!!message.content && (
          <Text style={[styles.text, { color: textColor }]}>
            {message.content}
          </Text>
        )}

        {/* Metadata (Time + Status) */}
        {isLastInGroup && (
          <View style={styles.metadata}>
            <Text style={[styles.time, { color: secondaryTextColor }]}>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isMe && (
              <MaterialCommunityIcons
                name={message.read_at ? 'check-all' : 'check'}
                size={14}
                color={secondaryTextColor}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        )}
      </Pressable>

      {/* Reactions */}
      {reactionEntries.length > 0 && (
        <View style={[styles.reactionRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
          {reactionEntries.map(([emoji, users]) => (
             <View
               key={`${message.id}-${emoji}`}
               style={[
                 styles.reactionChip,
                 { backgroundColor: theme.cardBackground, borderColor: theme.border }
               ]}
             >
               <Text style={styles.reactionEmoji}>{emoji}</Text>
               <Text style={[styles.reactionCount, { color: theme.text }]}>{users.length}</Text>
             </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function AttachmentItem({
  attachment,
  onPress,
  isMe,
  theme,
}: {
  attachment: Attachment;
  onPress: () => void;
  isMe: boolean;
  theme: any;
}) {
  if (attachment.type === 'image') {
    return (
      <Pressable onPress={onPress} style={styles.imageContainer}>
        <Image
          source={{ uri: attachment.url }}
          style={styles.image}
          contentFit="cover"
        />
      </Pressable>
    );
  }

  // Audio or File
  const iconName = attachment.type === 'audio' ? 'play-circle-outline' : 'file-document-outline';
  const bgColor = isMe ? 'rgba(255,255,255,0.2)' : theme.secondaryContainer;
  const textColor = isMe ? '#fff' : theme.text;
  const subTextColor = isMe ? 'rgba(255,255,255,0.7)' : theme.tabIconDefault;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.fileContainer, { backgroundColor: bgColor }]}
    >
      <MaterialCommunityIcons name={iconName} size={24} color={textColor} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.fileName, { color: textColor }]}>
          {attachment.name || 'Attachment'}
        </Text>
        {attachment.type === 'audio' && attachment.duration && (
            <Text style={[styles.fileSize, { color: subTextColor }]}>
             {Math.round(attachment.duration / 1000)}s
           </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    width: '100%',
  },
  bubbleContainer: {
    maxWidth: '80%', // Slightly wider on Android
    paddingHorizontal: 16,
    paddingVertical: 8, // Tighter
    minHeight: 40,
    overflow: 'hidden',
  },
  text: {
    fontSize: 16,
    lineHeight: 24, // Comfortable reading
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    fontWeight: '400',
  },
  imageContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 8,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 10,
    marginBottom: 8,
    minWidth: 160,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
  },
  reactionRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 4,
    paddingHorizontal: 4,
    width: '100%',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
});
