import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Modal, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { 
  IconButton, 
  Button, 
  Text as RNPText,
  Surface,
  Chip,
  Snackbar,
} from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/services/supabase';
import { AIService } from '@/services/ai-service';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Available tags for visualizations
const AVAILABLE_TAGS = ['AI', 'Neural Networks', 'Data Viz', 'NLP', 'GANs', 'Charts', 'Machine Learning', 'Deep Learning'];

export default function VisualizationFullscreenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const { user } = useAuth();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  // Determine if this is a public visualization (from DB) or private (from chat)
  const vizId = params.id as string | undefined;
  const isPublicViz = !!vizId;

  // State for public visualizations
  const [vizData, setVizData] = useState<{
    title: string;
    description: string | null;
    html_content: string;
    likes_count: number;
    views_count: number;
    author_username?: string;
    has_liked?: boolean;
  } | null>(null);
  const [loadingViz, setLoadingViz] = useState(isPublicViz);
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);

  // WebView error handling
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [webviewLoading, setWebviewLoading] = useState(true);

  // Share modal state (only for private visualizations)
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get HTML content - decode if it was encoded in URL
  let htmlContent: string;
  if (isPublicViz && vizData) {
    htmlContent = vizData.html_content;
  } else {
    const rawHtml = params.html as string;
    // Try to decode, but if it fails, use raw HTML (it might not be encoded)
    try {
      htmlContent = rawHtml ? decodeURIComponent(rawHtml) : '<!DOCTYPE html><html><body><h1>No visualization available</h1></body></html>';
    } catch (e) {
      // If decode fails, use raw HTML directly
      htmlContent = rawHtml || '<!DOCTYPE html><html><body><h1>No visualization available</h1></body></html>';
    }
  }

  // Load public visualization data
  useEffect(() => {
    if (isPublicViz && vizId) {
      loadPublicVisualization();
    }
  }, [isPublicViz, vizId]);

  const loadPublicVisualization = async () => {
    try {
      setLoadingViz(true);
      
      // Fetch visualization data
      const { data: viz, error: vizError } = await supabase
        .from('visualization_spaces')
        .select('*')
        .eq('id', vizId)
        .single();

      if (vizError) throw vizError;

      // Fetch author profile separately
      let authorUsername = 'unknown';
      if (viz.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', viz.user_id)
          .single();
        if (profile?.username) {
          authorUsername = profile.username;
        }
      }

      // Check if user has liked this
      let userLiked = false;
      if (user) {
        const { data: likeData } = await supabase
          .from('visualization_likes')
          .select('id')
          .eq('visualization_id', vizId)
          .eq('user_id', user.id)
          .single();
        userLiked = !!likeData;
      }

      setVizData({
        title: viz.title,
        description: viz.description,
        html_content: viz.html_content,
        likes_count: viz.likes_count,
        views_count: viz.views_count,
        author_username: authorUsername,
        has_liked: userLiked,
      });
      setHasLiked(userLiked);
      setLikesCount(viz.likes_count);
      setViewsCount(viz.views_count);
    } catch (err: any) {
      console.error('Error loading visualization:', err);
      setError('Failed to load visualization');
    } finally {
      setLoadingViz(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      setError('Please sign in to like');
      return;
    }

    if (!vizId) return;

    try {
      // Optimistic update
      const newLiked = !hasLiked;
      setHasLiked(newLiked);
      setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

      if (newLiked) {
        await supabase
          .from('visualization_likes')
          .insert({ visualization_id: vizId, user_id: user.id });
      } else {
        await supabase
          .from('visualization_likes')
          .delete()
          .eq('visualization_id', vizId)
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error handling like:', err);
      // Revert on error
      setHasLiked(!hasLiked);
      setLikesCount(prev => hasLiked ? prev + 1 : prev - 1);
    }
  };

  const injectMetaViewport = htmlContent.includes('viewport')
    ? htmlContent
    : htmlContent.replace('<head>', `<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`);

  const injectStyles = injectMetaViewport.replace(
    '<head>',
    `<head>
     <style>
       * { max-width: 100% !important; box-sizing: border-box; }
       body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
       html { overflow-x: hidden; }
     </style>`
  );

  // Generate AI title and description (for private visualizations)
  const generateAIContent = useCallback(async () => {
    if (!htmlContent) return;
    
    setGeneratingAI(true);
    setError(null);
    
    try {
      // Extract text content from HTML for context
      const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
      
      const systemPrompt = `You are an AI assistant that generates concise, engaging metadata for data visualizations and interactive content.
Analyze the provided HTML/visualization content and generate:
1. A catchy title (5-8 words max)
2. A brief description (2-3 sentences max)
3. 2-4 relevant tags from this list: ${AVAILABLE_TAGS.join(', ')}

Format your response as:
TITLE: [your title here]
DESCRIPTION: [your description here]
TAGS: [tag1, tag2, tag3]`;

      let result = '';
      await new Promise<void>((resolve, reject) => {
        AIService.streamChat(
          [{ 
            sender_id: 'user', 
            content: `Generate metadata for this visualization:\n\n${textContent}` 
          }],
          { 
            model: 'llama-3.3-70b', 
            temperature: 0.7, 
            max_tokens: 200, 
            systemPrompt: systemPrompt,
            provider: 'wafer'
          },
          (chunk) => { result += chunk; },
          () => resolve(),
          (err) => reject(err)
        );
      });

      // Parse the result
      const titleMatch = result.match(/TITLE:\s*(.+)/i);
      const descMatch = result.match(/DESCRIPTION:\s*(.+)/i);
      const tagsMatch = result.match(/TAGS:\s*(.+)/i);
      
      if (titleMatch) setTitle(titleMatch[1].trim());
      if (descMatch) setDescription(descMatch[1].trim());
      
      // Parse AI-generated tags
      if (tagsMatch) {
        const aiTags = tagsMatch[1].split(',').map(t => t.trim()).filter(t => t);
        // Only keep tags that exist in AVAILABLE_TAGS
        const validTags = aiTags.filter(tag => 
          AVAILABLE_TAGS.some(available => 
            available.toLowerCase() === tag.toLowerCase()
          )
        );
        setSelectedTags(validTags.slice(0, 4));
      }
      
    } catch (err: any) {
      console.error('AI generation error:', err);
      setError('Failed to analyze visualization. Please try again.');
    } finally {
      setGeneratingAI(false);
    }
  }, [htmlContent]);

  // Open share modal and auto-generate (only for private visualizations)
  const openShareModal = useCallback(() => {
    if (!user) {
      setError('Please sign in to share visualizations');
      return;
    }
    setShareModalVisible(true);
    // Auto-generate if fields are empty
    if (!title && !description) {
      generateAIContent();
    }
  }, [user, title, description, generateAIContent]);

  // Save visualization to Supabase (only for private visualizations)
  const saveVisualization = useCallback(async () => {
    if (!title.trim()) {
      setError('Please wait for AI to finish analyzing');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('visualization_spaces')
        .insert({
          user_id: user!.id,
          title: title.trim(),
          description: description.trim() || null,
          html_content: htmlContent,
          tags: selectedTags,
          is_public: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        setShareModalVisible(false);
        setSuccess(false);
        // Navigate to the new visualization in spaces
        router.push('/ai-spaces');
      }, 1500);

    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save visualization');
    } finally {
      setSaving(false);
    }
  }, [title, description, htmlContent, selectedTags, user, router]);

  if (loadingViz) {
    return (
      <View style={[styles.container, { backgroundColor: m3.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: m3.surface }]}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={m3.onSurface}
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={m3.primary} />
          <RNPText variant="bodyLarge" style={{ color: m3.onSurfaceVariant, marginTop: 16 }}>
            Loading visualization...
          </RNPText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: m3.surface }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={m3.onSurface}
          onPress={() => router.back()}
        />
        
        {/* Title for public visualizations */}
        {isPublicViz && vizData && (
          <View style={styles.titleContainer}>
            <RNPText variant="titleMedium" style={{ color: m3.onSurface, fontWeight: '600' }} numberOfLines={1}>
              {vizData.title}
            </RNPText>
            {vizData.author_username && (
              <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
                by @{vizData.author_username}
              </RNPText>
            )}
          </View>
        )}
        
        <View style={{ flex: 1 }} />
        
        {/* Like button for public visualizations */}
        {isPublicViz && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons 
                name="eye-outline" 
                size={18} 
                color={m3.onSurfaceVariant} 
              />
              <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginLeft: 4 }}>
                {viewsCount}
              </RNPText>
            </View>
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={handleLike}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons 
                name={hasLiked ? "heart" : "heart-outline"} 
                size={18} 
                color={hasLiked ? '#EC4899' : m3.onSurfaceVariant} 
              />
              <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginLeft: 4, fontWeight: '600' }}>
                {likesCount}
              </RNPText>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Share button only for private visualizations */}
        {!isPublicViz && (
          <IconButton
            icon="share-variant"
            size={24}
            iconColor={m3.onSurface}
            onPress={openShareModal}
          />
        )}
      </View>
      <SafeAreaView edges={['bottom']}style={styles.webviewContainer}>
          <WebView
            source={{ html: injectStyles }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            scalesPageToFit={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onLoadStart={() => setWebviewLoading(true)}
            onLoadEnd={() => setWebviewLoading(false)}
            onError={(err) => {
              console.error('WebView error:', err);
              setWebviewError(err.nativeEvent.description || 'Failed to load visualization');
              setWebviewLoading(false);
            }}
            onHttpError={(err) => {
              console.error('WebView HTTP error:', err);
              setWebviewError(`HTTP Error: ${err.nativeEvent.statusCode}`);
            }}
            renderLoading={() => (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: m3.background,
              }}>
                <ActivityIndicator size="large" color={m3.primary} />
                <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginTop: 12 }}>
                  Loading visualization...
                </RNPText>
              </View>
            )}
            startInLoadingState={true}
          />
          {webviewError && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 32,
              backgroundColor: m3.background,
            }}>
              <MaterialCommunityIcons name="alert-circle" size={48} color={m3.error} />
              <RNPText variant="titleMedium" style={{ color: m3.onSurface, marginTop: 16, textAlign: 'center' }}>
                Unable to load visualization
              </RNPText>
              <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                {webviewError}
              </RNPText>
              <Button
                mode="contained"
                onPress={() => {
                  setWebviewError(null);
                  setWebviewLoading(true);
                }}
                style={{ marginTop: 20 }}
              >
                Try Again
              </Button>
              {isPublicViz && (
                <Button
                  mode="outlined"
                  onPress={() => {
                    const encodedHtml = encodeURIComponent(injectStyles);
                    router.push({
                      pathname: '/visualization-fullscreen',
                      params: {
                        id: vizId,
                        html: encodedHtml,
                        title: vizData?.title,
                      }
                    });
                  }}
                  style={{ marginTop: 12 }}
                >
                  Reload from Source
                </Button>
              )}
            </View>
          )}
      </SafeAreaView>

      {/* Share Modal - Only for private visualizations */}
      {!isPublicViz && (
        <Modal
          visible={shareModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShareModalVisible(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <Surface style={[styles.modalContent, { backgroundColor: m3.surface }]}>
              <View style={styles.modalHeader}>
                <RNPText variant="headlineSmall" style={{ color: m3.onSurface, fontWeight: '700' }}>
                  Share Visualization
                </RNPText>
                <IconButton
                  icon="close"
                  size={24}
                  iconColor={m3.onSurface}
                  onPress={() => setShareModalVisible(false)}
                />
              </View>

              <ScrollView style={styles.modalBody}>
                {success ? (
                  <View style={styles.successContainer}>
                    <MaterialCommunityIcons name="check-circle" size={64} color={m3.primary} />
                    <RNPText variant="titleLarge" style={{ color: m3.onSurface, marginTop: 16, textAlign: 'center' }}>
                      Shared successfully!
                    </RNPText>
                  </View>
                ) : generatingAI ? (
                  <View style={styles.generatingContainer}>
                    <ActivityIndicator size="large" color={m3.primary} />
                    <RNPText variant="bodyLarge" style={{ color: m3.onSurface, marginTop: 16, textAlign: 'center' }}>
                      AI is analyzing your visualization...
                    </RNPText>
                    <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                      Generating title, description, and tags
                    </RNPText>
                  </View>
                ) : (
                  <>
                    {/* Title Display */}
                    <View style={styles.displayContainer}>
                      <RNPText variant="labelSmall" style={{ color: m3.onSurfaceVariant, marginBottom: 4 }}>
                        TITLE
                      </RNPText>
                      <RNPText variant="titleMedium" style={{ color: m3.onSurface, fontWeight: '600' }}>
                        {title || 'Generating...'}
                      </RNPText>
                    </View>

                    {/* Description Display */}
                    <View style={styles.displayContainer}>
                      <RNPText variant="labelSmall" style={{ color: m3.onSurfaceVariant, marginBottom: 4 }}>
                        DESCRIPTION
                      </RNPText>
                      <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, lineHeight: 20 }}>
                        {description || 'Generating...'}
                      </RNPText>
                    </View>

                    {/* Tags Display */}
                    <View style={styles.displayContainer}>
                      <RNPText variant="labelSmall" style={{ color: m3.onSurfaceVariant, marginBottom: 8 }}>
                        TAGS
                      </RNPText>
                      <View style={styles.tagsContainer}>
                        {selectedTags.length > 0 ? selectedTags.map(tag => (
                          <Chip
                            key={tag}
                            style={{ margin: 4, backgroundColor: m3.primaryContainer }}
                            textStyle={{ color: m3.onPrimaryContainer }}
                          >
                            {tag}
                          </Chip>
                        )) : (
                          <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
                            Analyzing content...
                          </RNPText>
                        )}
                      </View>
                    </View>

                    {/* AI Info */}
                    <View style={[styles.aiInfoContainer, { backgroundColor: m3.primaryContainer }]}
                    >
                      <MaterialCommunityIcons name="robot" size={20} color={m3.onPrimaryContainer} />
                      <RNPText variant="bodySmall" style={{ color: m3.onPrimaryContainer, marginLeft: 8, flex: 1 }}>
                        All content is auto-generated by AI based on your visualization.
                      </RNPText>
                    </View>

                    {/* Regenerate Button */}
                    <TouchableOpacity
                      onPress={generateAIContent}
                      disabled={generatingAI}
                      style={[styles.regenerateButton, { borderColor: m3.outline }]}
                    >
                      <MaterialCommunityIcons name="refresh" size={20} color={m3.primary} />
                      <RNPText variant="bodyMedium" style={{ color: m3.primary, marginLeft: 8, fontWeight: '600' }}>
                        Regenerate with AI
                      </RNPText>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>

              {!success && !generatingAI && (
                <View style={styles.modalFooter}>
                  <Button
                    mode="outlined"
                    onPress={() => setShareModalVisible(false)}
                    style={{ flex: 1, marginRight: 8 }}
                    textColor={m3.onSurface}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={saveVisualization}
                    loading={saving}
                    disabled={saving || !title.trim()}
                    style={{ flex: 1, backgroundColor: m3.primary }}
                  >
                    Share to Community
                  </Button>
                </View>
              )}
            </Surface>
          </View>
        </Modal>
      )}

      {/* Error Snackbar */}
      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        style={{ backgroundColor: m3.errorContainer }}
      >
        <RNPText style={{ color: m3.onErrorContainer }}>{error}</RNPText>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webviewContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalBody: {
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  aiInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  displayContainer: {
    marginBottom: 20,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
});
