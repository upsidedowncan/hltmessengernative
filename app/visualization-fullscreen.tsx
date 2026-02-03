import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { IconButton } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/contexts/theme-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VisualizationFullscreenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const htmlContent = params.html as string;

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

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: m3.surface }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={m3.onSurface}
          onPress={() => router.back()}
        />
      </View>
      <View style={styles.webviewContainer}>
        <WebView
          source={{ html: injectStyles }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scalesPageToFit={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  webviewContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
