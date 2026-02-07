import React from 'react';
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/theme-context';
import { ChatInputProps } from './types';

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  onAttach,
  isRecording,
  onRecordPressIn,
  onRecordPressOut,
  isLoading
}: ChatInputProps) {
  const { theme, isDarkMode } = useTheme();
  const [text, setText] = React.useState(value);

  React.useEffect(() => {
    if (value === '') {
        setText('');
    }
  }, [value]);

  const handleChangeText = (newText: string) => {
    setText(newText);
    onChangeText(newText);
  };
  
  const handleSend = () => {
    onSend(text);
  };
  
  const showSend = text.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      <View style={[styles.innerContainer, { backgroundColor: theme.secondaryContainer }]}>
        {/* Attach Button */}
        <Pressable 
          onPress={onAttach}
          android_ripple={{ color: theme.text, borderless: true, radius: 20 }}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="plus-circle" size={24} color={theme.text} />
        </Pressable>

        {/* Text Input */}
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          placeholder="Message..."
          placeholderTextColor={theme.tabIconDefault}
          style={[styles.input, { color: theme.text }]}
          multiline
          maxLength={1000}
        />

        {/* Send / Mic Button */}
        <Pressable
          onPress={showSend ? handleSend : undefined}
          onPressIn={!showSend ? onRecordPressIn : undefined}
          onPressOut={!showSend ? onRecordPressOut : undefined}
          style={styles.iconButton}
          android_ripple={{ color: theme.tint, borderless: true, radius: 20 }}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.tint} size="small" />
          ) : showSend ? (
            <MaterialCommunityIcons name="send" size={24} color={theme.tint} />
          ) : (
            <MaterialCommunityIcons 
              name={isRecording ? "microphone" : "microphone-outline"} 
              size={24} 
              color={isRecording ? theme.tint : theme.text} 
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Center vertically for single line
    borderRadius: 24,
    paddingHorizontal: 4,
    minHeight: 48,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120, // Expands
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    textAlignVertical: 'center',
  },
});
