import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Text as RNPText, Surface, TouchableRipple } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { ChatBubbleProps } from './chat-bubble.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatBubble({
  content,
  senderId,
  currentUserId,
  createdAt,
  isLastInGroup = true,
  isEdited = false,
  readAt = null,
  imageUrl,
  imageCaption,
  attachments = [],
  isStreaming = false,
  onCopy,
  onImagePress,
  onLongPress,
  children,
  markdownStyles: customMarkdownStyles,
}: ChatBubbleProps) {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const isMe = senderId === currentUserId;

  const defaultMarkdownStyles = {
    body: {
      color: isMe ? m3.onPrimaryContainer : m3.onSurface,
      fontSize: 15,
      marginVertical: 0,
      paddingVertical: 0,
      lineHeight: 18,
    },
    paragraph: { 
      marginVertical: 0, 
      paddingVertical: 0, 
      lineHeight: 18 
    },
    link: {
      color: isMe ? m3.onPrimaryContainer : m3.primary,
    },
    strong: {
      fontWeight: 'bold' as const,
    },
    em: {
      fontStyle: 'italic' as const,
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
    bullet_list: {
      marginTop: 0,
    },
    ordered_list: {
      marginTop: 0,
    },
    list_item: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
    },
    bullet_list_icon: {
      marginRight: 8,
      marginTop: 2,
    },
    ordered_list_icon: {
      marginRight: 8,
      marginTop: 0,
    },
  };

  const markdownStyles = customMarkdownStyles 
    ? { ...defaultMarkdownStyles, ...customMarkdownStyles }
    : defaultMarkdownStyles;

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
    } else if (onCopy && content) {
      onCopy(content);
    }
  };

  return (
    <View style={{ marginBottom: isLastInGroup ? 12 : 2 }}>
      {/* Image Attachment */}
      {imageUrl && (
        <View style={{ marginBottom: 4 }}>
          <TouchableOpacity 
            onPress={() => onImagePress?.(imageUrl)}
            style={{ 
              flexDirection: 'row', 
              justifyContent: isMe ? 'flex-end' : 'flex-start',
            }}
          >
            <Image 
              source={{ uri: imageUrl }} 
              style={{
                width: SCREEN_WIDTH * 0.6,
                height: SCREEN_WIDTH * 0.6,
                borderRadius: 16,
                backgroundColor: m3.surfaceContainerHighest,
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
          {imageCaption && (
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: isMe ? 'flex-end' : 'flex-start',
              marginTop: 4,
            }}>
              <View style={[
                styles.captionContainer, 
                { 
                  backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainerHighest,
                  borderTopLeftRadius: !isMe ? 4 : 12,
                  borderTopRightRadius: isMe ? 4 : 12,
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                }
              ]}>
                <RNPText 
                  variant="bodySmall" 
                  style={{ color: isMe ? m3.onPrimaryContainer : m3.onSurfaceVariant }}
                  selectable
                >
                  {imageCaption}
                </RNPText>
              </View>
            </View>
          )}
        </View>
      )}

      {/* File Attachments */}
      {attachments.length > 0 && (
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: isMe ? 'flex-end' : 'flex-start',
        }}>
          <View style={{ marginBottom: 8 }}>
            {attachments.map((att, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.fileAttachment, 
                  { 
                    backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainer,
                    marginBottom: idx < attachments.length - 1 ? 4 : 0
                  }
                ]}
              >
                <Ionicons 
                  name={att.type === 'image' ? 'image' : att.type === 'audio' ? 'musical-note' : 'document-text'} 
                  size={24} 
                  color={isMe ? m3.onPrimaryContainer : m3.onSurface} 
                />
                <RNPText 
                  variant="bodyMedium" 
                  style={{ color: isMe ? m3.onPrimaryContainer : m3.onSurface }} 
                  numberOfLines={1}
                >
                  {att.name || (att.type === 'image' ? 'Image' : att.type === 'audio' ? 'Audio' : 'File')}
                </RNPText>
                {att.size && (
                  <RNPText 
                    variant="bodySmall" 
                    style={{ color: m3.onSurfaceVariant, marginLeft: 8 }}
                  >
                    {(att.size / 1024 / 1024).toFixed(1)} MB
                  </RNPText>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Main Content Bubble */}
      <TouchableRipple 
        onLongPress={handleLongPress}
        style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start' }}
      >
        <Surface
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? m3.primaryContainer : m3.surfaceContainerHighest,
              borderTopLeftRadius: !isMe && !isLastInGroup ? 4 : 16,
              borderTopRightRadius: isMe && !isLastInGroup ? 4 : 16,
              borderBottomLeftRadius: !isMe ? 4 : 16,
              borderBottomRightRadius: isMe ? 4 : 16,
            }
          ]}
          elevation={0}
        >
          {children}
          
          {content && !isStreaming && (
            <Markdown style={markdownStyles}>
              {content}
            </Markdown>
          )}
          
          {isStreaming && (
            <RNPText style={{ color: isMe ? m3.onPrimaryContainer : m3.onSurface }}>
              ...
            </RNPText>
          )}
        </Surface>
      </TouchableRipple>

      {/* Metadata */}
      {isLastInGroup && (
        <View style={[
          styles.metadataContainer, 
          { justifyContent: isMe ? 'flex-end' : 'flex-start', marginRight: isMe ? 10 : 0 }
        ]}>
          <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </RNPText>
          
          {isMe && (
            <Ionicons
              name={readAt ? "checkmark-done" : "checkmark"}
              size={14}
              color={readAt ? m3.primary : m3.onSurfaceVariant}
              style={{ marginLeft: 4 }}
            />
          )}
          
          {isEdited && (
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginLeft: 4 }}>
              edited
            </RNPText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 8,
    paddingVertical: 0,
    overflow: 'visible',
    maxWidth: '75%',
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    maxWidth: 250,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
  },
  captionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: SCREEN_WIDTH * 0.6,
  },
});
