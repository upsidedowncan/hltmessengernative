import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { ChatInputProps } from './types';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

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

  // Sync with parent only when value is cleared (e.g. after send)
  // This prevents cursor jumping and character skipping during rapid typing
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
  
  // Animations
  const sendScale = useSharedValue(1);

  const sendButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: sendScale.value }],
    };
  });

  const handleSendPressIn = () => {
    sendScale.value = withSpring(0.9);
  };

  const handleSendPressOut = () => {
    sendScale.value = withSpring(1);
  };

  return (
    <BlurView 
      intensity={80} 
      tint={isDarkMode ? 'dark' : 'light'} 
      style={styles.blurContainer}
    >
      <View style={[styles.container, { borderTopColor: theme.border }]}>
        {/* Attach Button */}
        <TouchableOpacity 
          onPress={onAttach} 
          style={[styles.attachButton, { backgroundColor: theme.secondaryContainer }]}
        >
          <MaterialCommunityIcons name="plus" size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          placeholder="Message..."
          placeholderTextColor={theme.tabIconDefault}
          style={[
            styles.input, 
            { 
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              color: theme.text,
            }
          ]}
          multiline
          maxLength={1000}
        />

        {/* Send / Mic Button */}
        <AnimatedTouchableOpacity
          onPress={showSend ? handleSend : undefined}
          onPressIn={showSend ? handleSendPressIn : onRecordPressIn}
          onPressOut={showSend ? handleSendPressOut : onRecordPressOut}
          style={[
            styles.actionButton, 
            sendButtonStyle,
            { backgroundColor: showSend || isRecording ? theme.tint : theme.secondaryContainer }
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : showSend ? (
            <MaterialCommunityIcons name="arrow-up" size={24} color="#fff" />
          ) : (
            <MaterialCommunityIcons 
              name={isRecording ? "microphone" : "microphone-outline"} 
              size={24} 
              color={isRecording ? "#fff" : theme.text} 
            />
          )}
        </AnimatedTouchableOpacity>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 24, // Safe area handled by parent padding usually, but extra space looks nice
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2, // Align with input bottom
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 20,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
