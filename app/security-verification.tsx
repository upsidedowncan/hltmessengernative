import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Animated, Text, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { useSecurity } from '../src/context/SecurityContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, Surface } from 'react-native-paper';

const { width, height } = Dimensions.get('window');
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?';

interface ScrambleBlock {
  id: number;
  x: number;
  y: number;
  char: string;
  targetChar: string;
  progress: Animated.Value;
  delay: number;
}

export default function SecurityVerificationScreen() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const { verifyLogin } = useSecurity();
  const { isDarkMode } = useTheme();

  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

  const [verificationComplete, setVerificationComplete] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [blocks, setBlocks] = useState<ScrambleBlock[]>([]);
  const [messageProgress] = useState(new Animated.Value(0));
  const [messageScale] = useState(new Animated.Value(0.5));
  const [messageOpacity] = useState(new Animated.Value(0));
  const [verificationResult, setVerificationResult] = useState<{ allowed: boolean; reason: string } | null>(null);

  // Redirect if not coming from login
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, authLoading, router]);

  const containerRef = useRef<View>(null);

  // Initialize blocks for character scramble effect
  const initBlocks = useCallback(() => {
    const newBlocks: ScrambleBlock[] = [];
    const cols = Math.floor(width / 20);
    const rows = Math.floor(height / 24);
    let id = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        newBlocks.push({
          id: id++,
          x: col * 20,
          y: row * 24,
          char: CHARS[Math.floor(Math.random() * CHARS.length)],
          targetChar: '',
          progress: new Animated.Value(0),
          delay: (row * cols + col) * 0.5,
        });
      }
    }
    setBlocks(newBlocks);
  }, []);

  // Start verification animation and perform security check
  useEffect(() => {
    initBlocks();

    const performVerification = async () => {
      try {
        const result = await verifyLogin();
        setVerificationResult(result);
      } catch (error) {
        setVerificationResult({ allowed: true, reason: 'verification_error_fallback' });
      }
    };

    performVerification();

    // Animate blocks to form "VERIFYING..."
    const timer1 = setTimeout(() => {
      setBlocks(prev => prev.map(b => ({
        ...b,
        targetChar: 'VERIFYING...'.charAt(Math.floor((b.x / width) * 11)) || '',
      })));
    }, 100);

    // Animate through random chars
    const timer2 = setTimeout(() => {
      const interval = setInterval(() => {
        setBlocks(prev => prev.map(b => ({
          ...b,
          char: CHARS[Math.floor(Math.random() * CHARS.length)],
        })));
      }, 50);

      return () => clearInterval(interval);
    }, 500);

    // Complete verification after delay
    const timer3 = setTimeout(() => {
      // Animate message appearing
      Animated.parallel([
        Animated.timing(messageProgress, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(messageScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVerificationComplete(true);
        setShowContinue(true);
      });
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer3);
    };
  }, [initBlocks, messageProgress, messageScale, messageOpacity, verifyLogin]);

  const handleContinue = () => {
    if (verificationResult?.allowed) {
      router.replace('/(tabs)/chats');
    } else {
      router.replace('/(auth)/login');
    }
  };

  const getMessageText = () => {
    if (!verificationComplete) return 'Verifying...';
    
    if (verificationResult?.allowed) {
      return 'Security verification done!';
    }
    
    switch (verificationResult?.reason) {
      case 'account_locked':
        return 'Account temporarily locked';
      case 'suspicious_login_detected':
      case 'BLOCK':
        return 'Login blocked for security';
      case 'new_location_detected':
      case 'ADD_TRUST':
        return 'New location detected';
      case 'verification_error':
        return 'Security check failed';
      default:
        return verificationResult?.reason || 'Verification failed';
    }
  };

  const getSubMessage = () => {
    if (!shouldShowError) return null;
    
    switch (verificationResult?.reason) {
      case 'suspicious_login_detected':
        return 'Unusual login activity detected';
      case 'new_location_detected':
        return 'This location is different from your usual ones';
      case 'account_locked':
        return 'Too many failed attempts. Try again later.';
      default:
        return 'Please try again or contact support';
    }
  };

  const getMessageColor = () => {
    if (!verificationComplete) return m3.primary;
    
    if (verificationResult?.allowed) {
      return m3.primary;
    }
    
    return '#FF4444'; // Red for errors
  };

  const interpolatedMessage = messageProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['VERIFYING...', 'Security verification done!'],
  });

  const interpolatedScale = messageScale.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0.5, 1],
  });

  const interpolatedOpacity = messageOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const shouldShowError = verificationComplete && !verificationResult?.allowed;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.background }]} edges={['top']}>
      <Surface style={styles.surface} elevation={1}>
        <View style={styles.content}>
          {/* Character scramble grid */}
          <View style={styles.gridContainer} ref={containerRef}>
            {blocks.map((block) => (
              <Animated.Text
                key={block.id}
                style={[
                  styles.blockChar,
                  {
                    left: block.x,
                    top: block.y,
                    opacity: verificationComplete ? 0 : 1,
                  },
                ]}>
                {block.char}
              </Animated.Text>
            ))}
          </View>

          {/* Success message */}
          <Animated.View
            style={[
              styles.messageContainer,
              {
                transform: [{ scale: interpolatedScale }],
                opacity: interpolatedOpacity,
              },
            ]}>
            <Animated.Text
              style={[
                styles.messageText,
                { color: getMessageColor() },
              ]}>
              {getMessageText()}
            </Animated.Text>
            {shouldShowError && (
              <Animated.Text style={[styles.subMessage, { opacity: interpolatedOpacity }]}>
                {getSubMessage()}
              </Animated.Text>
            )}
          </Animated.View>

          {/* Continue button */}
          {showContinue && (
            <Animated.View style={styles.buttonContainer}>
              <Pressable
                style={[styles.button, { backgroundColor: shouldShowError ? '#FF4444' : m3.primary }]}
                onPress={handleContinue}>
                <Text style={[styles.buttonText, { color: m3.onPrimary }]}>
                  {shouldShowError ? 'Return to Login' : 'Continue'}
                </Text>
                {!shouldShowError && (
                  <Icon source="arrow-right" size={20} color={m3.onPrimary} style={{ marginLeft: 8 }} />
                )}
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  surface: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blockChar: {
    position: 'absolute',
    fontSize: 12,
    fontFamily: 'monospace',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  messageContainer: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  messageText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  subMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 48,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
