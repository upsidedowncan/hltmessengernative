import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Text as RNPText, Surface, Chip, TouchableRipple } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/context/ThemeContext';
import { PythonExecutionService } from '@/services/PythonExecutionService';

interface SystemOutputBlockProps {
  content: string;
}

export default function SystemOutputBlock({ content }: SystemOutputBlockProps) {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [activeTab, setActiveTab] = useState<'output' | 'files' | 'error'>('output');

  // Parse the system message content
  const parseContent = () => {
    const outputMatch = content.match(/\[PYTHON EXECUTION OUTPUT\]\n([\s\S]*?)(?=\[FILES CREATED\]|\[PYTHON EXECUTION ERROR\]|$)/);
    const filesMatch = content.match(/\[FILES CREATED\]\n([\s\S]*?)(?=\[PYTHON EXECUTION ERROR\]|$)/);
    const errorMatch = content.match(/\[PYTHON EXECUTION ERROR\]\n([\s\S]*)/);

    let output = outputMatch ? outputMatch[1].trim() : null;
    let error = errorMatch ? errorMatch[1].trim() : null;
    const files = filesMatch ? filesMatch[1].trim().split(', ').filter(f => f) : null;

    // If no explicit error tag but output contains Python error patterns, treat it as error
    if (!error && output) {
      const pythonErrorPatterns = [
        /Traceback \(most recent call last\)/i,
        /ZeroDivisionError:/i,
        /TypeError:/i,
        /ValueError:/i,
        /NameError:/i,
        /IndexError:/i,
        /KeyError:/i,
        /AttributeError:/i,
        /ImportError:/i,
        /ModuleNotFoundError:/i,
        /SyntaxError:/i,
        /RuntimeError:/i,
        /Exception:/i,
        /Error:/i,
      ];

      const hasError = pythonErrorPatterns.some(pattern => pattern.test(output as string));
      if (hasError) {
        error = output;
        output = null;
      }
    }

    return {
      output,
      files,
      error,
    };
  };

  const { output, files, error } = parseContent();

  const handleFilePress = async (filename: string) => {
    const url = await PythonExecutionService.getFileDownloadUrl(filename);
    Linking.openURL(url);
  };

  // If no special format detected, just show the plain content
  if (!output && !files && !error) {
    return (
      <Surface style={[styles.container, { backgroundColor: m3.surfaceContainerHighest }]} elevation={0}>
        <View style={[styles.header, { backgroundColor: m3.surfaceContainer }]}>
          <MaterialCommunityIcons name="console-line" size={16} color={m3.primary} />
          <RNPText variant="labelMedium" style={[styles.headerLabel, { color: m3.onSurfaceVariant }]}>
            SYSTEM OUTPUT
          </RNPText>
        </View>
        <ScrollView style={styles.content}>
          <RNPText 
            variant="bodySmall" 
            style={[styles.text, { color: m3.onSurface }]}
          >
            {content}
          </RNPText>
        </ScrollView>
      </Surface>
    );
  }

  const renderChip = (tab: 'output' | 'files' | 'error', label: string, icon: string, hasContent: boolean) => {
    const isActive = activeTab === tab;
    
    return (
      <Chip
        mode="flat"
        selected={isActive}
        onPress={() => hasContent && setActiveTab(tab)}
        disabled={!hasContent}
        style={{
          height: 32,
          borderRadius: 8,
          backgroundColor: isActive ? m3.primaryContainer : 'transparent',
          opacity: hasContent ? 1 : 0.4,
        }}
        textStyle={{ 
          color: isActive ? m3.onPrimaryContainer : m3.onSurfaceVariant,
          fontSize: 12,
        }}
        icon={() => (
          <MaterialCommunityIcons 
            name={icon as any} 
            size={16} 
            color={isActive ? m3.onPrimaryContainer : m3.onSurfaceVariant} 
          />
        )}
      >
        {label}
      </Chip>
    );
  };

  const renderOutputTab = () => (
    <ScrollView style={styles.tabPanel}>
      <View style={[styles.outputContainer, { backgroundColor: m3.surfaceContainer }]}>
        <RNPText variant="bodySmall" style={[styles.codeText, { color: m3.onSurface }]}>
          {output || 'No output'}
        </RNPText>
      </View>
    </ScrollView>
  );

  const renderFilesTab = () => (
    <ScrollView style={styles.tabPanel}>
      <View style={styles.filesGrid}>
        {files && files.map((file, index) => (
          <TouchableRipple
            key={index}
            onPress={() => handleFilePress(file)}
            style={[styles.fileCard, { backgroundColor: m3.surfaceContainer }]}
          >
            <View style={styles.fileCardInner}>
              <MaterialCommunityIcons name="file-document-outline" size={32} color={m3.primary} />
              <RNPText variant="bodySmall" style={[styles.fileCardName, { color: m3.onSurface }]} numberOfLines={2}>
                {file}
              </RNPText>
            </View>
          </TouchableRipple>
        ))}
      </View>
    </ScrollView>
  );

  const renderErrorTab = () => (
    <ScrollView style={styles.tabPanel}>
      <View style={[styles.errorContainer, { backgroundColor: m3.errorContainer }]}>
        <MaterialCommunityIcons name="alert-circle" size={20} color={m3.error} style={{ marginBottom: 8 }} />
        <RNPText variant="bodySmall" style={[styles.codeText, { color: m3.onErrorContainer }]}>
          {error}
        </RNPText>
      </View>
    </ScrollView>
  );

  return (
    <Surface style={[styles.container, { backgroundColor: m3.surfaceContainerHighest }]} elevation={0}>
      <View style={[styles.header, { backgroundColor: m3.surfaceContainer }]}>
        <MaterialCommunityIcons name="console" size={16} color={m3.primary} />
        <RNPText variant="labelMedium" style={[styles.headerLabel, { color: m3.onSurfaceVariant }]}>
          SYSTEM OUTPUT
        </RNPText>
      </View>
      
      {/* Tabs as Chips */}
      <View style={styles.chipContainer}>
        {renderChip('output', 'Output', 'code-greater-than', !!output)}
        {renderChip('files', 'Files', 'folder-open', !!(files && files.length > 0))}
        {renderChip('error', 'Error', 'alert-circle-outline', !!error)}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'output' && renderOutputTab()}
        {activeTab === 'files' && renderFilesTab()}
        {activeTab === 'error' && renderErrorTab()}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  headerLabel: {
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    justifyContent: 'flex-start',
  },
  chip: {
    height: 32,
    borderRadius: 8,
  },
  tabContentContainer: {
    maxHeight: 200,
  },
  tabPanel: {
    padding: 12,
  },
  content: {
    padding: 12,
    maxHeight: 200,
  },
  outputContainer: {
    padding: 12,
    borderRadius: 8,
  },
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 4,
  },
  fileCard: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fileCardInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fileCardName: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
  },
  text: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
