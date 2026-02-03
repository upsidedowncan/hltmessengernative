import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Button, Surface } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';

interface VisualizationBlockProps {
  htmlContent: string;
  type: 'embed' | 'full';
  messageId?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function VisualizationBlock({ 
  htmlContent, 
  type = 'embed',
  messageId = 'viz'
}: VisualizationBlockProps) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const maxEmbedWidth = Math.floor(SCREEN_WIDTH * 0.75 - 32);
  const embedHeight = Math.floor(SCREEN_WIDTH * 0.5);

  const injectMetaViewport = htmlContent.includes('viewport')
    ? htmlContent
    : htmlContent.replace('<head>', `<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`);

  const injectStyles = injectMetaViewport.replace(
    '<head>',
    `<head>
     <style>
       * { max-width: 100% !important; box-sizing: border-box; }
       html { overflow-x: hidden; }
       body { margin: 0; padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-x: hidden; }
     </style>`
  );

  const renderWebView = () => (
    <WebView
      source={{ html: injectStyles }}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      scalesPageToFit={true}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );

  const openFullscreen = () => {
    const encoded = encodeURIComponent(htmlContent);
    router.push(`/visualization-fullscreen?html=${encoded}`);
  };

  if (type === 'full') {
    return (
      <View style={{ marginVertical: 8 }}>
        <Button 
          mode="contained-tonal"
          onPress={openFullscreen}
          style={styles.fullscreenButton}
        >
          Open Visualization
        </Button>
      </View>
    );
  }

  // Embed type - WebView inline in the bubble
  return (
    <View style={[styles.embedContainer, { maxWidth: maxEmbedWidth }]}>
      <Surface 
        style={[
          styles.container, 
          { 
            backgroundColor: m3.surfaceContainerHighest,
            width: maxEmbedWidth,
            height: embedHeight,
          }
        ]} 
        elevation={0}
      >
        {renderWebView()}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  embedContainer: {
    marginVertical: 8,
  },
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullscreenButton: {
    alignSelf: 'flex-start',
  },
});
