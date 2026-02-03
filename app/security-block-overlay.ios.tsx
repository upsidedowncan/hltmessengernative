import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView } from 'react-native';
import { useSecurity } from '@/contexts/security-context';
import { useTheme } from '@/contexts/theme-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Host, Button, List } from '@expo/ui/swift-ui';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import UnlockVerificationChat from './unlock-verification-chat';

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const { theme } = useTheme();

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

  const errorColor = '#FF3B30';
  
  return (
    <View style={[styles.timerWrapper, { backgroundColor: errorColor + '20' }]}>
      <Text style={[styles.timerDigits, { color: errorColor }]}>{timeLeft}</Text>
      <Text style={[styles.timerCaption, { color: theme.tabIconDefault }]}>until you can try again</Text>
    </View>
  );
}

function FAQSection() {
  const { theme } = useTheme();
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
      <Text style={[styles.faqTitle, { color: theme.tabIconDefault }]}>Why did this happen?</Text>
      
      <View style={[styles.faqWrapper, { backgroundColor: theme.cardBackground }]}>
        <Animated.View style={[styles.fadeTop, topFadeStyle, { backgroundColor: theme.background }]} />
        
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
              <Pressable key={index} style={styles.faqItem}>
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.question}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.tabIconDefault} />
                </View>
                <Text style={[styles.faqAnswer, { color: theme.tabIconDefault }]}>{item.answer}</Text>
              </Pressable>
            ))}
            <View style={styles.faqSpacer} />
          </View>
        </ScrollView>
        
        <View style={[styles.fadeBottom, { backgroundColor: theme.background }]} />
      </View>
    </View>
  );
}

export default function SecurityBlockOverlay() {
  const { isBlocked, blockReason, lockoutExpiresAt, loading } = useSecurity();
  const { theme } = useTheme();
  const [showUnlockChat, setShowUnlockChat] = useState(false);
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
      <Animated.View style={[styles.container, containerStyle, { backgroundColor: theme.background }]}>
        <UnlockVerificationChat onClose={() => setShowUnlockChat(false)} />
      </Animated.View>
    );
  }

  const isLocked = blockReason === 'account_locked';

  return (
    <Animated.View style={[styles.container, containerStyle, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.topSection}>
            <View style={[styles.iconWrapper, { backgroundColor: '#FF3B30' + '20' }]}>
              <Ionicons name="lock-closed" size={56} color="#FF3B30" />
            </View>

            <Text style={[styles.heading, { color: theme.text }]}>
              {isLocked ? 'Access Temporarily Locked' : 'Security Alert'}
            </Text>

            <Text style={[styles.description, { color: theme.tabIconDefault }]}>
              {isLocked 
                ? "We've temporarily restricted access to your account due to unusual activity. This is a security measure to protect your data."
                : "We noticed something unusual about this login attempt. For your protection, access has been restricted."
              }
            </Text>

            {lockoutExpiresAt && (
              <CountdownTimer expiresAt={lockoutExpiresAt} />
            )}

            <Host style={styles.buttonHost}>
              <Button
                onPress={() => setShowUnlockChat(true)}
                variant="glassProminent"
                systemImage="message.fill"
              >
                Verify Identity & Unlock
              </Button>
            </Host>
            
            <Text style={[styles.unlockHint, { color: theme.tabIconDefault }]}>
              Chat with our AI to prove it's really you
            </Text>
          </View>

          <FAQSection />
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
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 340,
    marginBottom: 20,
  },
  timerWrapper: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  timerDigits: {
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerCaption: {
    fontSize: 13,
    marginTop: 4,
  },
  buttonHost: {
    width: '100%',
    height: 50,
    marginTop: 8,
  },
  unlockHint: {
    fontSize: 13,
    marginTop: 8,
  },
  faqOuterContainer: {
    flex: 1,
    marginTop: 16,
  },
  faqTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  faqWrapper: {
    flex: 1,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
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
  faqItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    paddingTop: 8,
  },
});
