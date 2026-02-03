import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Text as RNPText, Surface, IconButton } from 'react-native-paper';
import { Image } from 'expo-image';
import { useTheme } from '@/context/ThemeContext';
import { AIService } from '@/services/AIService';
import ChatBubble from '@/components/chat-bubble';

interface ImageGenBlockProps {
  jsonContent: string;
  messageId?: string;
  isLastInGroup?: boolean;
  onImageGenerated?: (uri: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ImageGenBlock({ 
  jsonContent, 
  messageId = 'image-gen',
  isLastInGroup = true,
  onImageGenerated 
}: ImageGenBlockProps) {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [params, setParams] = useState<{ prompt: string; model: string } | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const parseAndGenerate = async () => {
      try {
        const parsed = JSON.parse(jsonContent);
        if (!parsed.prompt) {
          if (mounted) setStatus('error');
          return;
        }
        
        if (mounted) {
          setParams({
            prompt: parsed.prompt,
            model: parsed.model || '@cf/black-forest-labs/flux-1-schnell'
          });
        }
        
        if (status === 'idle') {
          await generate(parsed.prompt, parsed.model);
        }
      } catch (e) {
        console.error('Failed to parse image gen params:', e);
        if (mounted) setStatus('error');
      }
    };
    
    parseAndGenerate();
    
    return () => { mounted = false; };
  }, [jsonContent]);

  const generate = async (prompt: string, model: string) => {
    setStatus('loading');
    try {
      const uri = await AIService.generateImage(prompt, model);
      if (uri) {
        setImageUri(uri);
        setStatus('success');
        onImageGenerated?.(uri);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      setStatus('error');
    }
  };

  const handleRetry = () => {
    if (params && status === 'error') {
      generate(params.prompt, params.model);
    }
  };

  if (status === 'error') {
    return (
      <Surface 
        style={[styles.container, { backgroundColor: m3.errorContainer }]} 
        elevation={0}
      >
        <View style={styles.errorContent}>
          <RNPText variant="bodyMedium" style={{ color: m3.onErrorContainer }}>
            Failed to generate image
          </RNPText>
          {params && (
            <RNPText variant="bodySmall" style={{ color: m3.onErrorContainer, marginTop: 4 }}>
              "{params.prompt}"
            </RNPText>
          )}
          <IconButton
            icon="refresh"
            size={20}
            iconColor={m3.onErrorContainer}
            onPress={handleRetry}
            style={{ marginTop: 8 }}
          />
        </View>
      </Surface>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <Surface 
        style={[styles.container, { backgroundColor: m3.surfaceContainerHighest }]} 
        elevation={0}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={m3.primary} />
          <RNPText 
            variant="bodyMedium" 
            style={{ color: m3.onSurfaceVariant, marginTop: 12 }}
          >
            Generating image...
          </RNPText>
          {params && (
            <RNPText 
              variant="bodySmall" 
              style={{ 
                color: m3.onSurfaceVariant, 
                marginTop: 4, 
                textAlign: 'center',
                fontStyle: 'italic'
              }}
            >
              "{params.prompt}"
            </RNPText>
          )}
        </View>
      </Surface>
    );
  }

  // Success state - use ChatBubble with imageUrl prop
  // Note: isLastInGroup is false because the parent message already shows the timestamp
  return (
    <>
      <ChatBubble
        id={messageId}
        content=""  // No text content, just the image
        senderId="ai"
        currentUserId="user"
        createdAt={new Date().toISOString()}
        isLastInGroup={false}  // Don't show timestamp, parent message shows it
        imageUrl={imageUri!}
        imageCaption={params?.prompt}
        onImagePress={() => setViewerVisible(true)}
      />
      
      {/* Full screen viewer modal */}
      {viewerVisible && imageUri && (
        <View style={StyleSheet.absoluteFillObject}>
          <Surface style={[styles.viewerContainer, { backgroundColor: m3.background }]} elevation={2}>
            <View style={[styles.viewerHeader, { backgroundColor: m3.surfaceContainer }]}>
              <RNPText variant="titleMedium" style={{ color: m3.onSurface }} numberOfLines={1}>
                {params?.prompt || 'Generated Image'}
              </RNPText>
              <IconButton
                icon="close"
                size={24}
                iconColor={m3.onSurface}
                onPress={() => setViewerVisible(false)}
              />
            </View>
            <View style={styles.viewerBody}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          </Surface>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    width: '75%',
  },
  loadingContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
