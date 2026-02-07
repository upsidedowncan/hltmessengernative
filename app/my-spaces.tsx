import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Appbar,
  Surface,
  Text as RNPText,
  IconButton,
  Modal,
  TextInput,
  Button,
  Divider,
  TouchableRipple,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/services/supabase';
import { AIService } from '@/services/ai-service';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PADDING = 16;
const MENU_WIDTH = 200;

interface MyVisualization {
  id: string;
  title: string;
  description: string | null;
  preview_url: string | null;
  likes_count: number;
  views_count: number;
  is_public: boolean;
  created_at: string;
}

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}

export default function MySpacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const { user } = useAuth();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const [visualizations, setVisualizations] = useState<MyVisualization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedViz, setSelectedViz] = useState<MyVisualization | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');

  // Custom menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, vizId: '' });
  
  const menuAnimation = useSharedValue(0);
  const menuScale = useSharedValue(0);
  const menuOpacity = useSharedValue(0);

  const closeMenu = () => {
    menuAnimation.value = withTiming(0, { duration: 150 });
    menuScale.value = withSpring(0, { damping: 55, stiffness: 520 });
    menuOpacity.value = withTiming(0, { duration: 100 });
  };

  const openMenu = (viz: MyVisualization, event: any) => {
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = MENU_WIDTH;
    const x = event.nativeEvent.pageX || menuAnchor.x;
    const y = event.nativeEvent.pageY || menuAnchor.y;
    
    const anchorX = x < screenWidth / 2 
      ? Math.max(16, x - 16)
      : Math.min(screenWidth - menuWidth + 16, x - menuWidth + 16);
    
    const anchorY = Math.min(y - 8, SCREEN_HEIGHT - 200);
    
    setMenuAnchor({ x: anchorX, y: anchorY, vizId: viz.id });
    menuAnimation.value = withTiming(1, { duration: 150 });
    menuScale.value = withSpring(1, { damping: 55, stiffness: 520 });
    menuOpacity.value = withTiming(1, { duration: 100 });
    setMenuVisible(true);
  };

  const fetchMyVisualizations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('visualization_spaces')
        .select('id, title, description, preview_url, likes_count, views_count, is_public, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setVisualizations(data || []);
    } catch (err: any) {
      console.error('Error fetching my visualizations:', err);
      setError(err.message || 'Failed to load visualizations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyVisualizations();
  }, [fetchMyVisualizations]);

  const handleDelete = async (vizId: string) => {
    try {
      await supabase
        .from('visualization_spaces')
        .delete()
        .eq('id', vizId);
      
      setVisualizations(prev => prev.filter(v => v.id !== vizId));
      closeMenu();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete');
    }
  };

  const handleTogglePublic = async (viz: MyVisualization) => {
    try {
      await supabase
        .from('visualization_spaces')
        .update({ is_public: !viz.is_public })
        .eq('id', viz.id);

      setVisualizations(prev =>
        prev.map(v => (v.id === viz.id ? { ...v, is_public: !viz.is_public } : v))
      );
      closeMenu();
    } catch (err: any) {
      console.error('Toggle error:', err);
      setError(err.message || 'Failed to update visibility');
    }
  };

  const openEditModal = async (viz: MyVisualization) => {
    try {
      const { data } = await supabase
        .from('visualization_spaces')
        .select('html_content')
        .eq('id', viz.id)
        .single();

      setSelectedViz(viz);
      setHtmlContent(data?.html_content || '');
      setEditPrompt('');
      setEditModalVisible(true);
      closeMenu();
    } catch (err: any) {
      console.error('Error loading visualization:', err);
      setError(err.message || 'Failed to load visualization');
    }
  };

  const handleEditWithAI = async () => {
    if (!editPrompt.trim() || !selectedViz) return;

    setEditing(true);
    setError(null);

    try {
      const systemPrompt = `You are an expert HTML/CSS/JavaScript developer.
Given the original visualization code and a modification request, generate improved code.

Original code:
${htmlContent}

Modification request: ${editPrompt}

Requirements:
1. Return ONLY the modified HTML code wrapped in <VISUALIZATION_FULL> tags
2. Keep the same overall structure but apply the requested changes
3. Make it responsive and visually appealing
4. Include all CSS and JS inline
5. Fix any errors in the original code`;

      let result = '';
      await new Promise<void>((resolve, reject) => {
        AIService.streamChat(
          [{ sender_id: 'user', content: systemPrompt }],
          {
            model: 'gpt-oss-120b',
            temperature: 0.5,
            max_tokens: 2048,
            systemPrompt: systemPrompt,
            provider: 'wafer',
          },
          (chunk) => { result += chunk; },
          () => resolve(),
          (err) => reject(err)
        );
      });

      const vizMatch = result.match(/<VISUALIZATION_FULL>([\s\S]*?)<\/VISUALIZATION_FULL>/i);
      const newHtml = vizMatch ? vizMatch[1].trim() : result.trim();

      if (!newHtml) {
        throw new Error('Failed to generate modified code');
      }

      await supabase
        .from('visualization_spaces')
        .update({ html_content: newHtml })
        .eq('id', selectedViz.id);

      setHtmlContent(newHtml);
      setEditPrompt('');
      setEditModalVisible(false);
      fetchMyVisualizations();
    } catch (err: any) {
      console.error('Edit error:', err);
      setError(err.message || 'Failed to edit visualization');
    } finally {
      setEditing(false);
    }
  };

  const handleRepublish = async () => {
    if (!selectedViz || !htmlContent) return;

    setEditing(true);
    setError(null);

    try {
      await supabase
        .from('visualization_spaces')
        .update({
          html_content: htmlContent,
          likes_count: 0,
          views_count: 0,
        })
        .eq('id', selectedViz.id);

      setEditModalVisible(false);
    } catch (err: any) {
      console.error('Republish error:', err);
      setError(err.message || 'Failed to republish');
    } finally {
      setEditing(false);
    }
  };

  const getMenuItems = (viz: MyVisualization): MenuItem[] => [
    {
      id: 'edit',
      title: 'Edit with AI',
      icon: 'auto-fix',
      onPress: () => openEditModal(viz),
    },
    {
      id: 'visibility',
      title: viz.is_public ? 'Make Private' : 'Make Public',
      icon: viz.is_public ? 'eye-off' : 'eye',
      onPress: () => handleTogglePublic(viz),
    },
    {
      id: 'delete',
      title: 'Delete',
      icon: 'delete',
      onPress: () => handleDelete(viz.id),
      danger: true,
    },
  ];

  const AnimatedMenu = () => {
    const viz = visualizations.find(v => v.id === menuAnchor.vizId);
    if (!viz) return null;

    const menuItems = getMenuItems(viz);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: menuScale.value }],
      opacity: menuOpacity.value,
    }));

    if (menuAnimation.value === 0) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View 
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
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
            backgroundColor: m3.surface,
            position: 'absolute',
            left: menuAnchor.x,
            top: menuAnchor.y,
            width: MENU_WIDTH,
          }
        ]}>
          {menuItems.map((item, index) => (
            <TouchableRipple
              key={item.id}
              onPress={item.onPress}
              style={styles.menuItem}
            >
              <View style={styles.menuItemContent}>
                <RNPText variant="bodyLarge" style={{ color: item.danger ? m3.error : m3.onSurface }}>
                  {item.title}
                </RNPText>
                <MaterialCommunityIcons 
                  name={item.icon} 
                  size={22} 
                  color={item.danger ? m3.error : m3.onSurfaceVariant} 
                />
              </View>
            </TouchableRipple>
          ))}
        </Animated.View>
      </View>
    );
  };

  const renderVisualization = ({ item }: { item: MyVisualization }) => (
    <Surface key={item.id} style={[styles.card, { backgroundColor: m3.surfaceContainer }]} elevation={1}>
      <TouchableOpacity
        onPress={() => {
          const encodedHtml = encodeURIComponent(item.preview_url || '<html></html>');
          router.push({
            pathname: '/visualization-fullscreen',
            params: { id: item.id }
          });
        }}
      >
        <Image
          source={{ uri: item.preview_url || 'https://via.placeholder.com/400x300/1a1a1a/6366F1?text=Viz' }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      </TouchableOpacity>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <RNPText variant="titleMedium" style={{ color: m3.onSurface, fontWeight: '600' }} numberOfLines={1}>
            {item.title}
          </RNPText>
          <IconButton
            icon="dots-vertical"
            size={20}
            iconColor={m3.onSurfaceVariant}
            onPress={(e) => openMenu(item, e)}
          />
        </View>

        <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginBottom: 8 }}>
          {item.description || 'No description'}
        </RNPText>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="heart" size={14} color={m3.onSurfaceVariant} />
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginLeft: 4 }}>
              {item.likes_count}
            </RNPText>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="eye" size={14} color={m3.onSurfaceVariant} />
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginLeft: 4 }}>
              {item.views_count}
            </RNPText>
          </View>
          <View style={[styles.visibilityBadge, { backgroundColor: item.is_public ? m3.primaryContainer : m3.surfaceContainerHighest }]}>
            <RNPText variant="labelSmall" style={{ color: item.is_public ? m3.onPrimaryContainer : m3.onSurfaceVariant }}>
              {item.is_public ? 'Public' : 'Private'}
            </RNPText>
          </View>
        </View>
      </View>
    </Surface>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: m3.background }]}>
        <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface }}>
          <Appbar.BackAction onPress={() => router.back()} iconColor={m3.onSurface} />
          <Appbar.Content title="My Spaces" titleStyle={{ color: m3.onSurface }} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={m3.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.background }]} edges={['right', 'left', 'bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface }}>
        <Appbar.BackAction onPress={() => router.back()} iconColor={m3.onSurface} />
        <Appbar.Content title="My Spaces" titleStyle={{ color: m3.onSurface }} />
      </Appbar.Header>

      <FlatList
        data={visualizations}
        keyExtractor={item => item.id}
        renderItem={renderVisualization}
        contentContainerStyle={{ padding: PADDING, paddingBottom: insets.bottom + PADDING }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchMyVisualizations();
            }}
            tintColor={m3.primary}
            colors={[m3.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="image-outline" size={64} color={m3.onSurfaceVariant} />
            <RNPText variant="bodyLarge" style={{ color: m3.onSurfaceVariant, marginTop: 16, textAlign: 'center' }}>
              No visualizations yet
            </RNPText>
            <RNPText variant="bodySmall" style={{ color: m3.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
              Create your first visualization from the Community Spaces tab
            </RNPText>
          </View>
        }
      />

      <AnimatedMenu />

      <Modal
        visible={editModalVisible}
        onDismiss={() => setEditModalVisible(false)}
        contentContainerStyle={[styles.editModal, { backgroundColor: m3.surface }]}
      >
        <View style={styles.modalHeader}>
          <RNPText variant="titleLarge" style={{ color: m3.onSurface, fontWeight: '700' }}>
            Edit Visualization
          </RNPText>
          <IconButton icon="close" iconColor={m3.onSurface} onPress={() => setEditModalVisible(false)} />
        </View>

        <ScrollView style={styles.modalBody}>
          <RNPText variant="titleMedium" style={{ color: m3.onSurface, marginBottom: 8 }}>
            {selectedViz?.title}
          </RNPText>

          <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginBottom: 16 }}>
            Describe what changes you want to make:
          </RNPText>

          <TextInput
            value={editPrompt}
            onChangeText={setEditPrompt}
            placeholder="e.g., Change the colors to blue theme, Add animation, Make it responsive..."
            mode="outlined"
            multiline
            numberOfLines={4}
            style={{ backgroundColor: m3.surface, marginBottom: 16 }}
            outlineColor={m3.outline}
            activeOutlineColor={m3.primary}
            textColor={m3.onSurface}
          />

          <Button
            mode="contained"
            onPress={handleEditWithAI}
            loading={editing}
            disabled={editing || !editPrompt.trim()}
            style={{ backgroundColor: m3.primary, marginBottom: 8 }}
            icon="auto-fix"
          >
            Generate Changes with AI
          </Button>

          <Divider style={{ marginVertical: 16 }} />

          <RNPText variant="titleMedium" style={{ color: m3.onSurface, marginBottom: 8 }}>
            Preview
          </RNPText>

          <TouchableOpacity
            style={[styles.previewButton, { backgroundColor: m3.surfaceContainer }]}
            onPress={() => {
              const encodedHtml = encodeURIComponent(htmlContent);
              router.push({
                pathname: '/visualization-fullscreen',
                params: { html: encodedHtml }
              });
            }}
          >
            <MaterialCommunityIcons name="play" size={20} color={m3.primary} />
            <RNPText variant="bodyMedium" style={{ color: m3.primary, marginLeft: 8 }}>
              Preview Changes
            </RNPText>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button
            mode="outlined"
            onPress={() => setEditModalVisible(false)}
            textColor={m3.onSurface}
            style={{ flex: 1, marginRight: 8 }}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleRepublish}
            loading={editing}
            disabled={editing}
            style={{ flex: 1, backgroundColor: m3.primary }}
            icon="publish"
          >
            Republish
          </Button>
        </View>
      </Modal>

      <View style={[styles.snackbar, { backgroundColor: m3.errorContainer }]}>
        <RNPText style={{ color: m3.onErrorContainer }}>{error}</RNPText>
        <TouchableOpacity onPress={() => setError(null)}>
          <MaterialCommunityIcons name="close" size={20} color={m3.onErrorContainer} />
        </TouchableOpacity>
      </View>
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  card: {
    width: (SCREEN_WIDTH - PADDING * 2 - 12) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  customMenu: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1000,
  },
  menuItem: {
    paddingVertical: 4,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editModal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalBody: {
    padding: 16,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  snackbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
});
