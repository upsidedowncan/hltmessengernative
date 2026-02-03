import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ToastAndroid } from 'react-native';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Text as RNPText, Surface, IconButton, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { PythonExecutionService, PythonExecutionResult } from '../../services/PythonExecutionService';

interface PythonCodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  onExecute?: (result: PythonExecutionResult) => void;
  showExecuteButton?: boolean;
}

export default function PythonCodeBlock({
  code,
  language = 'python',
  filename,
  onExecute,
  showExecuteButton = true,
}: PythonCodeBlockProps) {
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isPython = language === 'python' || language === 'py';

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    ToastAndroid.show('Code copied to clipboard', ToastAndroid.SHORT);
  };

  const handleExecute = async () => {
    if (!isPython) return;
    
    setIsExecuting(true);
    try {
      const result = await PythonExecutionService.executeCode(code);
      onExecute?.(result);
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  // Simple syntax highlighting
  const renderHighlightedCode = () => {
    const keywords = ['import', 'from', 'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'return', 'yield', 'lambda', 'async', 'await', 'pass', 'break', 'continue', 'raise', 'assert', 'del', 'global', 'nonlocal'];
    const strings = ["'", '"', '"""', "'''"];
    const comments = ['#'];
    
    const lines = code.split('\n');
    const maxLines = isExpanded ? lines.length : Math.min(15, lines.length);
    const displayLines = lines.slice(0, maxLines);
    const hasMore = lines.length > 15 && !isExpanded;

    return (
      <View>
        {displayLines.map((line, index) => (
          <View key={index} style={styles.codeLine}>
            <RNPText variant="bodySmall" style={[styles.lineNumber, { color: m3.onSurfaceVariant }]}>
              {index + 1}
            </RNPText>
            <RNPText 
              variant="bodySmall" 
              style={[styles.codeText, { color: m3.onSurface }]}
              numberOfLines={1}
            >
              {line || ' '}
            </RNPText>
          </View>
        ))}
        {hasMore && (
          <TouchableOpacity onPress={() => setIsExpanded(true)}>
            <RNPText 
              variant="bodySmall" 
              style={[styles.showMore, { color: m3.primary }]}
            >
              Show {lines.length - 15} more lines...
            </RNPText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Surface 
      style={[styles.container, { backgroundColor: m3.surfaceContainerHighest }]} 
      elevation={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: m3.surfaceContainer }]}>
        <View style={styles.headerLeft}>
          <Ionicons 
            name={isPython ? "logo-python" : "code-slash"} 
            size={16} 
            color={isPython ? '#306998' : m3.primary} 
          />
          <RNPText variant="labelMedium" style={[styles.language, { color: m3.onSurfaceVariant }]} numberOfLines={1}>
            {isPython ? (filename ? filename : 'PYTHON EXEC') : language.toUpperCase()}
          </RNPText>
        </View>
        <View style={styles.headerRight}>
          {isPython && showExecuteButton && (
            <IconButton
              icon={isExecuting ? "loading" : "play"}
              size={18}
              iconColor={m3.primary}
              onPress={handleExecute}
              disabled={isExecuting}
              style={styles.iconButton}
            />
          )}
          <IconButton
            icon="content-copy"
            size={18}
            iconColor={m3.onSurfaceVariant}
            onPress={handleCopy}
            style={styles.iconButton}
          />
        </View>
      </View>

      {/* Code */}
      <ScrollView 
        horizontal 
        style={styles.codeScroll}
        showsHorizontalScrollIndicator={true}
      >
        <View style={styles.codeContainer}>
          {renderHighlightedCode()}
        </View>
      </ScrollView>

      {/* Footer with execute button for large code */}
      {code.length > 500 && isPython && showExecuteButton && (
        <View style={[styles.footer, { borderTopColor: m3.outlineVariant }]}>
          <TouchableOpacity 
            style={[styles.executeButton, { backgroundColor: m3.primaryContainer }]} 
            onPress={handleExecute}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color={m3.primary} />
            ) : (
              <>
                <Ionicons name="play" size={16} color={m3.primary} />
                <RNPText variant="labelMedium" style={[styles.executeText, { color: m3.primary }]}>
                  Run Code
                </RNPText>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  language: {
    marginLeft: 6,
  },
  iconButton: {
    margin: 0,
    padding: 0,
  },
  codeScroll: {
    maxHeight: 300,
  },
  codeContainer: {
    padding: 12,
    minWidth: 300,
  },
  codeLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineNumber: {
    width: 30,
    textAlign: 'right',
    marginRight: 12,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  codeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  showMore: {
    textAlign: 'center',
    paddingVertical: 8,
  },
  footer: {
    borderTopWidth: 1,
    padding: 8,
    alignItems: 'flex-end',
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  executeText: {
    fontWeight: '600',
  },
});
