import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSecurity } from '../src/context/SecurityContext';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useTheme } from '../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Text, IconButton, List, Divider, Button } from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import UnlockVerificationChat from './UnlockVerificationChat';

function CountdownTimer({ expiresAt, m3 }: { expiresAt: string; m3: any }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const expires = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, expires - now);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <Surface style={[styles.timerSurface, { backgroundColor: m3.errorContainer }]}>
      <Text variant="headlineLarge" style={[styles.timerDigits, { color: m3.error }]}>
        {timeLeft}
      </Text>
      <Text variant="bodySmall" style={{ color: m3.onErrorContainer }}>
        until you can try again
      </Text>
    </Surface>
  );
}

function FAQSection({ m3 }: { m3: any }) {
  const faqData = [
    { question: "New location detected", answer: "You logged in from a different city or country than usual. This could be from traveling, using a VPN, or logging in from a new device." },
    { question: "Multiple failed attempts", answer: "Too many incorrect password attempts were made. For security, we temporarily lock accounts after several failed logins." },
    { question: "Suspicious activity pattern", answer: "Our AI detected unusual behavior patterns, such as rapid login attempts from different locations or devices." },
    { question: "How long does the lock last?", answer: "Temporary locks typically last 24 hours. You'll see a countdown timer above showing exactly how much time remains." },
    { question: "What should I do now?", answer: "Wait for the timer to expire, then try logging in again. Make sure you're using your usual device and network. Check your email for any security alerts." },
    { question: "Can I speed this up?", answer: "No, for security reasons the lock duration cannot be shortened. This protects your account from unauthorized access attempts." },
  ];

  const scrollY = useSharedValue(0);
  
  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 30],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <View style={styles.faqOuterContainer}>
      <Text variant="labelLarge" style={[styles.faqTitle, { color: m3.onSurfaceVariant }]}>
        Why did this happen?
      </Text>
      
      <Surface style={[styles.faqContainer, { backgroundColor: m3.surfaceContainerHighest }]}>
        <Animated.View style={[styles.fadeTop, topFadeStyle, { backgroundColor: m3.surfaceContainerHighest }]} />
        
        <ScrollView
          style={styles.faqScroll}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollY.value = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.faqContent}>
            {faqData.map((item, index) => (
              <List.Accordion
                key={index}
                title={item.question}
                titleStyle={{ color: m3.onSurface }}
                style={{ backgroundColor: m3.surfaceContainerHighest }}
                theme={{ colors: { primary: m3.primary } }}
              >
                <List.Item
                  title={item.answer}
                  titleNumberOfLines={0}
                  titleStyle={{ color: m3.onSurfaceVariant, fontSize: 14, lineHeight: 20 }}
                  style={{ backgroundColor: m3.surfaceContainerHighest }}
                />
              </List.Accordion>
            ))}
            <View style={styles.faqSpacer} />
          </View>
        </ScrollView>
        
        <View style={[styles.fadeBottom, { backgroundColor: m3.surfaceContainerHighest }]} />
      </Surface>
    </View>
  );
}

export default function SecurityBlockOverlay() {
  const { isBlocked, blockReason, lockoutExpiresAt, loading } = useSecurity();
  const [showUnlockChat, setShowUnlockChat] = useState(false);
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);

  useEffect(() => {
    if (isBlocked && !loading) {
      fadeAnim.value = withTiming(1, { duration: 400 });
      slideAnim.value = withSpring(0, {
        damping: 20,
        stiffness: 100,
      });
    }
  }, [isBlocked, loading]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  if (!isBlocked || loading) return null;

  if (showUnlockChat) {
    return (
      <Animated.View style={[styles.container, containerStyle, { backgroundColor: m3.background }]}>
        <UnlockVerificationChat onClose={() => setShowUnlockChat(false)} />
      </Animated.View>
    );
  }

  const isLocked = blockReason === 'account_locked';

  return (
    <Animated.View style={[styles.container, containerStyle, { backgroundColor: m3.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.topSection}>
            <Surface style={[styles.iconSurface, { backgroundColor: m3.errorContainer }]}>
              <IconButton
                icon="lock"
                size={40}
                iconColor={m3.error}
              />
            </Surface>

            <Text 
              variant="headlineSmall" 
              style={[styles.heading, { color: m3.onBackground }]}
            >
              {isLocked ? 'Access Temporarily Locked' : 'Security Alert'}
            </Text>

            <Text 
              variant="bodyMedium" 
              style={[styles.description, { color: m3.onSurfaceVariant }]}
            >
              {isLocked 
                ? "We've temporarily restricted access to your account due to unusual activity. This is a security measure to protect your data."
                : "We noticed something unusual about this login attempt. For your protection, access has been restricted."
              }
            </Text>

            {lockoutExpiresAt && (
              <CountdownTimer expiresAt={lockoutExpiresAt} m3={m3} />
            )}

            <Button
              mode="contained"
              icon="chat"
              onPress={() => setShowUnlockChat(true)}
              style={[styles.unlockButton, { backgroundColor: m3.primary }]}
              labelStyle={{ color: m3.onPrimary }}
            >
              Verify Identity & Unlock
            </Button>
            
            <Text 
              variant="bodySmall" 
              style={[styles.unlockHint, { color: m3.onSurfaceVariant }]}
            >
              Chat with our AI to prove it's really you
            </Text>
          </View>

          <FAQSection m3={m3} />
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  topSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconSurface: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: {
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 340,
    marginBottom: 20,
  },
  timerSurface: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  timerDigits: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  unlockButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  unlockHint: {
    marginTop: 8,
    textAlign: 'center',
  },
  faqOuterContainer: {
    flex: 1,
    marginTop: 16,
  },
  faqTitle: {
    marginBottom: 12,
    marginLeft: 4,
  },
  faqContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  faqScroll: {
    flex: 1,
  },
  faqContent: {
    paddingTop: 4,
  },
  faqSpacer: {
    height: 20,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 10,
    opacity: 0,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 10,
  },
});
