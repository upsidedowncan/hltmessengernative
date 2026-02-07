import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { Appbar, Surface, Text as RNPText, Avatar, Snackbar, TextInput, Button, Modal, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/services/supabase';
import { AIService } from '@/services/ai-service';

// Types
interface Visualization {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  preview_url: string | null;
  html_content: string;
  tags: string[];
  likes_count: number;
  views_count: number;
  created_at: string;
  author_username?: string;
  has_liked?: boolean;
}

const FILTERS = ['All', 'Neural Networks', 'Data Viz', 'NLP', 'GANs', 'Charts'];

// Filter keywords mapping
const FILTER_KEYWORDS: Record<string, string[]> = {
  'Neural Networks': ['Neural Networks', 'Deep Learning', 'Attention', 'Transformer'],
  'Data Viz': ['Data Science', 'Pipelines', 'Charts', 'Visualization'],
  'NLP': ['NLP', 'Sentiment Analysis', 'Embeddings', 'Language'],
  'GANs': ['GAN', 'Art', 'Generation', 'StyleGAN'],
  'Charts': ['Charts', 'Visualization', 'Data Viz'],
};

// Animated Chip Component
function AnimatedFilterChip({
  filter,
  isSelected,
  onPress,
  m3,
}: {
  filter: string;
  isSelected: boolean;
  onPress: () => void;
  m3: any;
}) {
  const progress = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(isSelected ? 1 : 0, {
      damping: 20,
      stiffness: 200,
    });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [m3.surfaceContainer, m3.primary]
    );

    return {
      backgroundColor,
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 1],
      [m3.onSurface, m3.onPrimary]
    );

    return {
      color,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.animatedChip, animatedStyle]}>
        <Animated.Text style={[styles.chipText, textAnimatedStyle]}>
          {filter}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAP = 12;
const PADDING = 16;
const COLUMN_WIDTH = (SCREEN_WIDTH - (PADDING * 2) - GAP) / 2;

export default function AISpacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const { user } = useAuth();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const [selectedFilter, setSelectedFilter] = useState('All');
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalStats, setTotalStats] = useState({ visualizations: 0, users: 0, views: 0 });

  // Create visualization modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createPrompt, setCreatePrompt] = useState('');
  const [generatingViz, setGeneratingViz] = useState(false);
  const [isFeelingLucky, setIsFeelingLucky] = useState(false);

  // Fetch visualizations from Supabase
  const fetchVisualizations = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch trending visualizations
      const { data: vizData, error: vizError } = await supabase
        .rpc('get_trending_visualizations', { limit_count: 50 });

      if (vizError) throw vizError;

      // If user is logged in, fetch their likes
      let likedVizIds: string[] = [];
      if (user) {
        const { data: likesData, error: likesError } = await supabase
          .from('visualization_likes')
          .select('visualization_id')
          .eq('user_id', user.id);

        if (!likesError && likesData) {
          likedVizIds = likesData.map(like => like.visualization_id);
        }
      }

      // Fetch total stats
      const { data: statsData, error: statsError } = await supabase
        .from('visualization_spaces')
        .select('views_count', { count: 'exact', head: true });

      const { count: vizCount, error: countError } = await supabase
        .from('visualization_spaces')
        .select('*', { count: 'exact', head: true });

      const { count: userCount, error: userCountError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (statsData && !statsError) {
        const totalViews = vizData?.reduce((sum: number, v: any) => sum + (v.views_count || 0), 0) || 0;
        setTotalStats({
          visualizations: vizCount || 0,
          users: userCount || 0,
          views: totalViews,
        });
      }

      // Merge data with likes info
      const processedData = (vizData || []).map((v: any) => ({
        ...v,
        has_liked: likedVizIds.includes(v.id),
      }));

      setVisualizations(processedData);
    } catch (err: any) {
      console.error('Error fetching visualizations:', err);
      setError(err.message || 'Failed to load visualizations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Generate visualization with AI
  const generateVisualization = useCallback(async (lucky = false) => {
    if (!createPrompt.trim() && !lucky) {
      setError('Please describe what you want to visualize or click "I\'m Feeling Lucky"');
      return;
    }

    setGeneratingViz(true);
    setError(null);

    try {
      const systemPrompt = `You are an expert in creating HTML/CSS/JavaScript visualizations with advanced libraries.
Create a complete HTML visualization based on the user's request using appropriate libraries from the CDN list below.

AVAILABLE CDN LIBRARIES (use as needed):
- Three.js (3D): https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
  Use for: 3D scenes, WebGL, 3D games, data visualization in 3D space
  
- Matter.js (2D Physics): https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js
  Use for: 2D physics simulations, rigid bodies, collisions, gravity
  
- Cannon-es (3D Physics): https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js
  Use for: 3D physics, rigid bodies, collisions in Three.js scenes
  
- Chart.js: https://cdn.jsdelivr.net/npm/chart.js
  Use for: Bar charts, line charts, pie charts, data visualization
  
- D3.js: https://d3js.org/d3.v7.min.js
  Use for: Complex data visualizations, SVG charts, interactive graphics
  
- p5.js: https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.6.0/p5.min.js
  Use for: Creative coding, generative art, animations
  
- Phaser: https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js
  Use for: 2D games, platformers, arcade games
  
- PixiJS: https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js
  Use for: 2D graphics, particle systems, game sprites
  
- Tone.js: https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js
  Use for: Audio synthesis, music, sound effects

Requirements:
1. Return ONLY valid HTML code (no markdown, no explanations)
2. Load libraries via CDN <script> tags in the head
3. Include initialization code in a <script> tag at the end of body
4. Make it responsive (works on mobile screens 375px+)
5. Include proper viewport meta tag
6. Add loading indicator or placeholder while libraries load
7. Use modern ES6+ syntax where appropriate
8. Always handle window resize for responsive canvas
9. MUST be touch-friendly and mobile-optimized:
   - All interactive elements must be at least 44x44px for touch targets
   - Use touch events (touchstart/touchend) instead of just click for interactions
   - Add visual feedback for touch interactions
   - Avoid hover-dependent interactions
   - Consider swipe gestures where appropriate
   - Make animations smooth (60fps) and not too fast for mobile
8. Always handle window resize for responsive canvas

Format: Return only the HTML code, wrapped in <VISUALIZATION_FULL> tags.

Example structure for Three.js:
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>body { margin: 0; overflow: hidden; }</style>
</head>
<body>
  <div id="loading">Loading 3D Scene...</div>
  <script>
    // Three.js code here
    const scene = new THREE.Scene();
    // ... rest of visualization
  </script>
</body>
</html>`;

      let htmlResult = '';
      await new Promise<void>((resolve, reject) => {
        AIService.streamChat(
          [{ 
            sender_id: 'user', 
            content: isFeelingLucky ? `I'm feeling lucky! Generate a creative and unexpected visualization for me. Surprise me with something unique and beautiful.` : createPrompt 
          }],
          { 
            model: 'gpt-oss-120b', 
            temperature: 0.9, 
            max_tokens: 2048, 
            systemPrompt: systemPrompt,
            provider: 'wafer'
          },
          (chunk) => { htmlResult += chunk; },
          () => resolve(),
          (err) => reject(err)
        );
      });

      // Extract HTML from tags
      const vizMatch = htmlResult.match(/<VISUALIZATION_FULL>([\s\S]*?)<\/VISUALIZATION_FULL>/i);
      const finalHtml = vizMatch ? vizMatch[1].trim() : htmlResult.trim();

      if (!finalHtml) {
        throw new Error('Failed to generate visualization');
      }

      // Close modal and navigate to fullscreen with the generated HTML
      setCreateModalVisible(false);
      setCreatePrompt('');
      setIsFeelingLucky(false);
      
      const encodedHtml = encodeURIComponent(finalHtml);
      router.push({
        pathname: '/visualization-fullscreen',
        params: { 
          html: encodedHtml,
        }
      });

    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate visualization');
    } finally {
      setGeneratingViz(false);
    }
  }, [createPrompt, router, isFeelingLucky]);

  // Initial fetch
  useEffect(() => {
    fetchVisualizations();
  }, [fetchVisualizations]);

  // Filter visualizations based on selected filter
  const filteredVisualizations = React.useMemo(() => {
    if (selectedFilter === 'All') {
      return visualizations;
    }

    const keywords = FILTER_KEYWORDS[selectedFilter] || [selectedFilter];
    
    return visualizations.filter(item => 
      item.tags?.some(tag => 
        keywords.some(keyword => 
          tag.toLowerCase().includes(keyword.toLowerCase())
        )
      )
    );
  }, [selectedFilter, visualizations]);

  // Split filtered data into two columns
  const leftColumn = filteredVisualizations.filter((_, index) => index % 2 === 0);
  const rightColumn = filteredVisualizations.filter((_, index) => index % 2 === 1);

  // Handle like/unlike
  const handleLike = async (vizId: string, hasLiked: boolean) => {
    if (!user) {
      setError('Please sign in to like visualizations');
      return;
    }

    try {
      // Optimistic update
      setVisualizations(prev => 
        prev.map(v => 
          v.id === vizId 
            ? { 
                ...v, 
                has_liked: !hasLiked,
                likes_count: hasLiked ? v.likes_count - 1 : v.likes_count + 1 
              } 
            : v
        )
      );

      if (hasLiked) {
        // Unlike
        await supabase
          .from('visualization_likes')
          .delete()
          .eq('visualization_id', vizId)
          .eq('user_id', user.id);
      } else {
        // Like
        await supabase
          .from('visualization_likes')
          .insert({ visualization_id: vizId, user_id: user.id });
      }
    } catch (err: any) {
      console.error('Error handling like:', err);
      // Revert on error
      fetchVisualizations();
    }
  };

  // Track view and navigate
  const handleVisualizationPress = async (item: Visualization) => {
    try {
      // Track view
      await supabase
        .from('visualization_views')
        .insert({ 
          visualization_id: item.id,
          viewer_id: user?.id || null 
        });

      // Navigate to fullscreen
      const encodedHtml = encodeURIComponent(item.html_content);
      router.push({
        pathname: '/visualization-fullscreen',
        params: { 
          id: item.id,
          html: encodedHtml,
          title: item.title,
        }
      });
    } catch (err) {
      console.error('Error tracking view:', err);
      // Still navigate even if tracking fails
      const encodedHtml = encodeURIComponent(item.html_content);
      router.push({
        pathname: '/visualization-fullscreen',
        params: { 
          id: item.id,
          html: encodedHtml,
          title: item.title,
        }
      });
    }
  };

  // Render tile component
  const renderTile = (item: Visualization) => {
    const hasLiked = item.has_liked || false;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tile}
        onPress={() => handleVisualizationPress(item)}
        activeOpacity={0.9}
      >
        {/* Preview Image */}
        <Image
          source={{ uri: item.preview_url || 'https://via.placeholder.com/400x300/1a1a1a/6366F1?text=AI+Visualization' }}
          style={styles.tileImage}
          resizeMode="cover"
        />
        
        {/* Gradient Overlay */}
        <View style={styles.overlay} />

        {/* Top: Tags */}
        <View style={styles.tagsContainer}>
          {item.tags?.slice(0, 2).map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <RNPText variant="labelSmall" style={styles.tagText}>
                {tag}
              </RNPText>
            </View>
          ))}
        </View>

        {/* Bottom: Info */}
        <View style={styles.tileContent}>
          <RNPText 
            variant="titleSmall" 
            style={styles.tileTitle}
            numberOfLines={2}
          >
            {item.title}
          </RNPText>
          
          <RNPText 
            variant="bodySmall" 
            style={styles.tileDescription}
            numberOfLines={2}
          >
            {item.description || 'No description'}
          </RNPText>

            {/* Author & Stats */}
          <View style={styles.authorRow}>
            <View style={styles.authorInfo}>
              <Avatar.Text 
                label={(item.author_username || 'U').charAt(0).toUpperCase()} 
                size={20} 
                style={[styles.authorAvatar, { backgroundColor: m3.primary }]} 
                labelStyle={{ color: m3.onPrimary, fontSize: 10 }}
              />
              <RNPText variant="bodySmall" style={styles.authorName}>
                @{item.author_username || 'unknown'}
              </RNPText>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons 
                  name="eye-outline" 
                  size={12} 
                  color="#fff" 
                />
                <RNPText variant="bodySmall" style={styles.statText}>
                  {item.views_count}
                </RNPText>
              </View>
              
              <TouchableOpacity 
                style={styles.statItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLike(item.id, hasLiked);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons 
                  name={hasLiked ? "heart" : "heart-outline"} 
                  size={12} 
                  color={hasLiked ? '#EC4899' : '#fff'} 
                />
                <RNPText variant="bodySmall" style={styles.statText}>
                  {item.likes_count}
                </RNPText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: m3.background }]}>
        <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface }}>
          <Appbar.BackAction onPress={() => router.back()} color={m3.onSurface} />
          <Appbar.Content title="Spaces" titleStyle={{ color: m3.onSurface }} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={m3.primary} />
          <RNPText variant="bodyLarge" style={{ color: m3.onSurfaceVariant, marginTop: 16 }}>
            Loading visualizations...
          </RNPText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.background }]} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} color={m3.onSurface} />
        <Appbar.Content title="Spaces" titleStyle={{ color: m3.onSurface }} />
        <Appbar.Action 
          icon="image-multiple" 
          onPress={() => router.push('/my-spaces')} 
          color={m3.onSurface}
        />
        <Appbar.Action 
          icon="plus" 
          onPress={() => setCreateModalVisible(true)} 
          color={m3.onSurface}
        />
      </Appbar.Header>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{
          padding: PADDING,
          paddingBottom: insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchVisualizations();
            }}
            tintColor={m3.primary}
            colors={[m3.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <RNPText variant="headlineSmall" style={[styles.headerTitle, { color: m3.onSurface }]}>
            Community Spaces
          </RNPText>
          <RNPText variant="bodyLarge" style={[styles.headerSubtitle, { color: m3.onSurfaceVariant }]}>
            Discover visualizations created by the AI community
          </RNPText>
        </View>

        {/* Filter Chips - Using Animated Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((filter) => (
            <AnimatedFilterChip
              key={filter}
              filter={filter}
              isSelected={selectedFilter === filter}
              onPress={() => setSelectedFilter(filter)}
              m3={m3}
            />
          ))}
        </ScrollView>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Surface style={[styles.statCard, { backgroundColor: m3.surfaceContainer }]} elevation={1}>
            <RNPText variant="headlineMedium" style={{ color: m3.primary, fontWeight: '700' }}>
              {totalStats.visualizations}
            </RNPText>
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
              Visualizations
            </RNPText>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: m3.surfaceContainer }]} elevation={1}>
            <RNPText variant="headlineMedium" style={{ color: m3.primary, fontWeight: '700' }}>
              {totalStats.users}
            </RNPText>
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
              Community
            </RNPText>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: m3.surfaceContainer }]} elevation={1}>
            <RNPText variant="headlineMedium" style={{ color: m3.primary, fontWeight: '700' }}>
              {totalStats.views > 1000 ? `${(totalStats.views / 1000).toFixed(1)}k` : totalStats.views}
            </RNPText>
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>
              Total Views
            </RNPText>
          </Surface>
        </View>

        {/* Section Title with count */}
        <RNPText variant="titleMedium" style={[styles.sectionTitle, { color: m3.onSurface }]}>
          {selectedFilter === 'All' ? 'Trending Now' : `${selectedFilter} (${filteredVisualizations.length})`}
        </RNPText>
        
        {/* Two Column Grid */}
        {filteredVisualizations.length > 0 ? (
          <View style={styles.grid}>
            <View style={styles.column}>
              {leftColumn.map(item => renderTile(item))}
            </View>
            <View style={styles.column}>
              {rightColumn.map(item => renderTile(item))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="filter-off" size={64} color={m3.onSurfaceVariant} />
            <RNPText variant="bodyLarge" style={{ color: m3.onSurfaceVariant, marginTop: 16 }}>
              No visualizations found for {selectedFilter}
            </RNPText>
            <TouchableOpacity 
              onPress={() => setSelectedFilter('All')}
              style={[styles.clearFilterButton, { backgroundColor: m3.primary }]}
            >
              <RNPText variant="bodyMedium" style={{ color: m3.onPrimary, fontWeight: '600' }}>
                Clear Filter
              </RNPText>
            </TouchableOpacity>
          </View>
        )}

        {/* Load More - Hidden when filtering */}
        {selectedFilter === 'All' && filteredVisualizations.length > 0 && (
          <TouchableOpacity 
            style={[styles.loadMoreButton, { borderColor: m3.outline }]}
            onPress={() => {
              // TODO: Implement pagination
              console.log('Load more visualizations');
            }}
          >
            <RNPText variant="bodyLarge" style={{ color: m3.primary, fontWeight: '600' }}>
              Load More
            </RNPText>
            <MaterialCommunityIcons name="chevron-down" size={24} color={m3.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Create Visualization Modal */}
      <Modal
        visible={createModalVisible}
        onDismiss={() => {
          setCreateModalVisible(false);
          setCreatePrompt('');
          setIsFeelingLucky(false);
        }}
        contentContainerStyle={[styles.createModal, { backgroundColor: m3.surface }]}
      >
        <View style={styles.createModalContent}>
          <View style={styles.createModalHeader}>
            <RNPText variant="headlineSmall" style={{ color: m3.onSurface, fontWeight: '700' }}>
              Create Visualization
            </RNPText>
            <IconButton
              icon="close"
              size={24}
              iconColor={m3.onSurface}
              onPress={() => {
                setCreateModalVisible(false);
                setCreatePrompt('');
                setIsFeelingLucky(false);
              }}
            />
          </View>

          {generatingViz ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color={m3.primary} />
              <RNPText variant="bodyLarge" style={{ color: m3.onSurface, marginTop: 16, textAlign: 'center' }}>
                {isFeelingLucky ? 'Creating something amazing...' : 'Creating your visualization...'}
              </RNPText>
              <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                {isFeelingLucky ? 'Surprise incoming!' : 'This may take a moment'}
              </RNPText>
            </View>
          ) : (
            <>
              <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginBottom: 12 }}>
                Describe what you want to visualize, or try your luck!
              </RNPText>
              
              <TextInput
                value={createPrompt}
                onChangeText={setCreatePrompt}
                placeholder="e.g., A colorful bouncing ball animation..."
                mode="outlined"
                multiline
                numberOfLines={3}
                style={{ backgroundColor: m3.surface, marginBottom: 12 }}
                outlineColor={m3.outline}
                activeOutlineColor={m3.primary}
                textColor={m3.onSurface}
              />

              <Button
                mode="contained-tonal"
                onPress={() => generateVisualization(true)}
                disabled={generatingViz}
                style={{ marginBottom: 12 }}
                icon="dice-5"
                theme={{
                  colors: {
                    primary: m3.primary,
                    onSurface: m3.onSurface,
                    surfaceVariant: m3.surfaceVariant,
                    onSurfaceVariant: m3.onSurfaceVariant,
                    outline: m3.outline,
                  }
                }}
              >
                I'm Feeling Lucky
              </Button>

              <Button
                mode="contained"
                onPress={() => generateVisualization(false)}
                loading={generatingViz}
                disabled={generatingViz || !createPrompt.trim()}
                style={{ backgroundColor: m3.primary, marginBottom: 8 }}
                icon="creation"
              >
                Generate with GPT-OSS-120B
              </Button>

              <Button
                mode="text"
                onPress={() => {
                  setCreateModalVisible(false);
                  setCreatePrompt('');
                }}
                textColor={m3.onSurfaceVariant}
              >
                Cancel
              </Button>
            </>
          )}
        </View>
      </Modal>

      {/* Error Snackbar */}
      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        style={{ backgroundColor: m3.errorContainer }}
      >
        <RNPText style={{ color: m3.onErrorContainer }}>{error}</RNPText>
      </Snackbar>
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    marginRight: 8,
    height: 36,
  },
  animatedChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontWeight: '600',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    gap: GAP,
  },
  column: {
    width: COLUMN_WIDTH,
    gap: GAP,
  },
  tile: {
    width: COLUMN_WIDTH,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  tileImage: {
    ...StyleSheet.absoluteFillObject,
    width: COLUMN_WIDTH,
    height: 220,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tagsContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
    zIndex: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  tagText: {
    color: '#fff',
    fontSize: 10,
  },
  tileContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    zIndex: 2,
  },
  tileTitle: {
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tileDescription: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    lineHeight: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  authorName: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  clearFilterButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  loadMoreButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createModal: {
    margin: 20,
    borderRadius: 28,
    padding: 0,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  createModalContent: {
    padding: 24,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  generatingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  luckyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 16,
  },
  promptSuggestions: {
    marginBottom: 16,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  promptInputContainer: {
    marginBottom: 16,
  },
  feelingLuckyButton: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  generateButton: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  cancelTouchable: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
