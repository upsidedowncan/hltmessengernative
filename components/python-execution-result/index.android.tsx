import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, Dimensions } from 'react-native';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Text as RNPText, Surface, IconButton, ActivityIndicator, TouchableRipple } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { PythonExecutionResult as ExecutionResult, PythonFile, PythonExecutionService } from '@/services/python-execution-service';
import { WebView } from 'react-native-webview';

interface PythonExecutionResultProps {
  result: ExecutionResult;
  onClose?: () => void;
  onRerun?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PythonExecutionResultComponent({
  result,
  onClose,
  onRerun,
}: PythonExecutionResultProps) {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [files, setFiles] = useState<PythonFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PythonFile | null>(null);
  const [activeTab, setActiveTab] = useState<'output' | 'files' | 'error'>('output');

  useEffect(() => {
    loadFiles();
  }, [result]);

  const loadFiles = async () => {
    if (result.files.length === 0) return;
    
    setLoadingFiles(true);
    try {
      const fileList = await PythonExecutionService.getFiles();
      // Filter only files mentioned in the result
      const relevantFiles = fileList.filter(f => result.files.includes(f.name));
      setFiles(relevantFiles);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFilePress = async (file: PythonFile) => {
    if (file.type === 'html') {
      setSelectedFile(file);
    } else if (file.type === 'image') {
      setSelectedFile(file);
    } else {
      // Download other files
      const url = await PythonExecutionService.getFileDownloadUrl(file.name);
      Linking.openURL(url);
    }
  };

  const hasError = result.status === 'Error' || result.error;
  const hasOutput = result.output && result.output.trim().length > 0;
  const hasFiles = files.length > 0;

  // Auto-switch to error tab if there's an error
  useEffect(() => {
    if (hasError && activeTab === 'output') {
      setActiveTab('error');
    }
  }, [hasError]);

  const renderTabButton = (tab: 'output' | 'files' | 'error', label: string, icon: string, count?: number) => {
    const isActive = activeTab === tab;
    const isDisabled = tab === 'output' ? !hasOutput : tab === 'files' ? !hasFiles : !hasError;
    
    return (
      <TouchableRipple
        onPress={() => !isDisabled && setActiveTab(tab)}
        style={[
          styles.tabButton,
          isActive && { backgroundColor: m3.primaryContainer },
          isDisabled && { opacity: 0.4 },
        ]}
        disabled={isDisabled}
      >
        <View style={styles.tabContent}>
          <Ionicons 
            name={icon as any} 
            size={16} 
            color={isActive ? m3.primary : m3.onSurfaceVariant} 
          />
          <RNPText 
            variant="labelMedium" 
            style={{ color: isActive ? m3.primary : m3.onSurfaceVariant }}
          >
            {label} {count !== undefined && `(${count})`}
          </RNPText>
        </View>
      </TouchableRipple>
    );
  };

  const renderOutputTab = () => (
    <ScrollView style={styles.tabPanel}>
      <View style={[styles.outputContainer, { backgroundColor: m3.surfaceContainerHighest }]}>
        <RNPText 
          variant="bodySmall" 
          style={[styles.outputText, { color: m3.onSurface }]}
        >
          {result.output || 'No output'}
        </RNPText>
      </View>
    </ScrollView>
  );

  const handleDownloadFile = async (file: PythonFile) => {
    const url = await PythonExecutionService.getFileDownloadUrl(file.name);
    Linking.openURL(url);
  };

  const renderFilesTab = () => (
    <ScrollView style={styles.tabPanel}>
      {loadingFiles ? (
        <ActivityIndicator style={styles.loader} color={m3.primary} />
      ) : files.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open" size={48} color={m3.onSurfaceVariant} />
          <RNPText variant="bodyMedium" style={{ color: m3.onSurfaceVariant, marginTop: 8 }}>
            No files generated
          </RNPText>
        </View>
      ) : (
        <View style={styles.fileGrid}>
          {files.map((file) => (
            <View
              key={file.name}
              style={[styles.fileCard, { backgroundColor: m3.surfaceContainer }]}
            >
              <TouchableRipple
                onPress={() => handleFilePress(file)}
                style={styles.fileCardTouchArea}
              >
                <View style={styles.fileContent}>
                  <Ionicons 
                    name={
                      file.type === 'html' ? 'globe' : 
                      file.type === 'image' ? 'image' : 
                      file.type === 'text' ? 'document-text' : 
                      'document'
                    } 
                    size={32} 
                    color={m3.primary} 
                  />
                  <RNPText 
                    variant="bodySmall" 
                    style={[styles.fileName, { color: m3.onSurface }]} 
                    numberOfLines={2}
                  >
                    {file.name}
                  </RNPText>
                </View>
              </TouchableRipple>
              <View style={styles.fileActions}>
                <IconButton
                  icon="download"
                  size={18}
                  iconColor={m3.primary}
                  onPress={() => handleDownloadFile(file)}
                  style={styles.downloadButton}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderErrorTab = () => (
    <ScrollView style={styles.tabPanel}>
      <View style={[styles.errorContainer, { backgroundColor: m3.errorContainer }]}>
        <Ionicons name="warning" size={24} color={m3.error} style={{ marginBottom: 8 }} />
        <RNPText 
          variant="bodySmall" 
          style={[styles.errorText, { color: m3.onErrorContainer }]}
        >
          {result.error || 'Unknown error occurred'}
        </RNPText>
      </View>
    </ScrollView>
  );

  const renderFilePreview = () => {
    if (!selectedFile) return null;

    return (
      <Surface style={[styles.previewContainer, { backgroundColor: m3.background }]} elevation={2}>
        <View style={[styles.previewHeader, { backgroundColor: m3.surfaceContainer }]}>
          <RNPText variant="titleMedium" style={{ color: m3.onSurface }} numberOfLines={1}>
            {selectedFile.name}
          </RNPText>
          <IconButton
            icon="close"
            size={24}
            iconColor={m3.onSurface}
            onPress={() => setSelectedFile(null)}
          />
        </View>
        <View style={styles.previewBody}>
          {selectedFile.type === 'html' ? (
            <WebView
              source={{ uri: selectedFile.url }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
            />
          ) : selectedFile.type === 'image' ? (
            <Image
              source={{ uri: selectedFile.url }}
              style={{ width: '100%', height: 300 }}
              resizeMode="contain"
            />
          ) : (
            <WebView
              source={{ uri: selectedFile.url }}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Surface>
    );
  };

  return (
    <Surface 
      style={[styles.container, { backgroundColor: m3.surfaceContainerLow }]} 
      elevation={1}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: m3.surfaceContainer }]}>
        <View style={styles.headerLeft}>
          <View style={[
            styles.statusBadge,
            { 
              backgroundColor: result.status === 'Success' ? m3.tertiaryContainer : m3.errorContainer,
            }
          ]}>
            <Ionicons 
              name={result.status === 'Success' ? 'checkmark-circle' : 'close-circle'} 
              size={16} 
              color={result.status === 'Success' ? m3.tertiary : m3.error} 
            />
            <RNPText 
              variant="labelMedium" 
              style={{ 
                color: result.status === 'Success' ? m3.onTertiaryContainer : m3.onErrorContainer,
                marginLeft: 4,
              }}
            >
              {result.status}
            </RNPText>
          </View>
        </View>
        <View style={styles.headerRight}>
          {onRerun && (
            <IconButton
              icon="refresh"
              size={20}
              iconColor={m3.primary}
              onPress={onRerun}
              style={styles.headerIcon}
            />
          )}
          {onClose && (
            <IconButton
              icon="close"
              size={20}
              iconColor={m3.onSurfaceVariant}
              onPress={onClose}
              style={styles.headerIcon}
            />
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: m3.outlineVariant }]}>
        {renderTabButton('output', 'Output', 'terminal', hasOutput ? result.output.split('\n').length : 0)}
        {renderTabButton('files', 'Files', 'folder', files.length)}
        {renderTabButton('error', 'Error', 'alert-circle', hasError ? 1 : undefined)}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'output' && renderOutputTab()}
        {activeTab === 'files' && renderFilesTab()}
        {activeTab === 'error' && renderErrorTab()}
      </View>

      {/* File Preview Modal */}
      {selectedFile && renderFilePreview()}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerIcon: {
    margin: 0,
    padding: 0,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  content: {
    flex: 1,
    maxHeight: 300,
  },
  tabPanel: {
    flex: 1,
  },
  outputContainer: {
    padding: 12,
    margin: 8,
    borderRadius: 8,
  },
  outputText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  fileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  fileCard: {
    width: 100,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fileCardTouchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fileContent: {
    alignItems: 'center',
  },
  fileName: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11,
  },
  fileActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 4,
  },
  downloadButton: {
    margin: 0,
    padding: 0,
  },
  errorContainer: {
    padding: 12,
    margin: 8,
    borderRadius: 8,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loader: {
    margin: 32,
  },
  previewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  previewBody: {
    flex: 1,
  },
});
