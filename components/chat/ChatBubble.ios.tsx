import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
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

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function ChatBubble({
  message,
  isMe,
  isLastInGroup,
  onLongPress,
  onAttachmentPress,
}: ChatBubbleProps) {
  const { theme } = useTheme();

  const handleLongPress = (event: any) => {
    Haptics.selectionAsync();
    const { nativeEvent } = event;
    onLongPress(message, nativeEvent.pageX, nativeEvent.pageY);
  };

  const bubbleStyle: ViewStyle = {
    backgroundColor: isMe ? theme.tint : theme.cardBackground,
    borderTopLeftRadius: !isMe && !isLastInGroup ? 4 : 20,
    borderTopRightRadius: isMe && !isLastInGroup ? 4 : 20,
    borderBottomLeftRadius: !isMe ? 4 : 20,
    borderBottomRightRadius: isMe ? 4 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  };

  const textColor = isMe ? '#fff' : theme.text;
  const secondaryTextColor = isMe ? 'rgba(255,255,255,0.7)' : theme.tabIconDefault;

  const reactionEntries = Object.entries(message.reactions || {}).filter(
    ([, users]) => Array.isArray(users) && users.length > 0
  );

  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify()}
      layout={Layout.springify()}
      style={[
        styles.container,
        { justifyContent: isMe ? 'flex-end' : 'flex-start' },
        isLastInGroup ? { marginBottom: 12 } : { marginBottom: 2 },
      ]}
    >
      <AnimatedTouchableOpacity
        onLongPress={handleLongPress}
        activeOpacity={0.9}
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

        {/* Metadata (Time + Status) - Only for last in group or if explicitly needed */}
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
      </AnimatedTouchableOpacity>

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
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.imageContainer}>
        <Image
          source={{ uri: attachment.url }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      </TouchableOpacity>
    );
  }

  // Audio or File
  const iconName = attachment.type === 'audio' ? 'play-circle-outline' : 'file-document-outline';
  const bgColor = isMe ? 'rgba(255,255,255,0.2)' : theme.secondaryContainer;
  const textColor = isMe ? '#fff' : theme.text;
  const subTextColor = isMe ? 'rgba(255,255,255,0.7)' : theme.tabIconDefault;

  return (
    <TouchableOpacity
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    width: '100%',
  },
  bubbleContainer: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
  },
  imageContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
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
