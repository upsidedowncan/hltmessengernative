import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Text,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { useSecurity } from '@/contexts/security-context';
import { Host, Button } from '@expo/ui/swift-ui';

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
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

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
    if (verificationComplete && verificationResult?.allowed) return null;
    
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
    if (!verificationComplete) return theme.tint;
    
    if (verificationResult?.allowed) {
      return theme.tint;
    }
    
    return '#FF4444'; // Red for errors
  };

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
    <Host style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
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
                  color: theme.tabIconDefault,
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
            <Animated.Text style={[styles.subMessage, { opacity: interpolatedOpacity, color: theme.tabIconDefault }]}>
              {getSubMessage()}
            </Animated.Text>
          )}
        </Animated.View>

        {/* Continue button */}
        {showContinue && (
          <Animated.View style={[styles.buttonContainer, { bottom: insets.bottom + 48 }]}>
            <View style={styles.buttonWrapper}>
              <Button
                onPress={handleContinue}
                variant={shouldShowError ? 'borderedProminent' : 'glassProminent'}
              >
                {shouldShowError ? 'Return to Login' : 'Continue'}
              </Button>
            </View>
          </Animated.View>
        )}
      </View>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  messageContainer: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  subMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  continueButton: {
    width: '100%',
    height: 50,
  },
});
