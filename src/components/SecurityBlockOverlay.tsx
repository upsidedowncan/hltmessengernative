import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSecurity } from '../context/SecurityContext';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('00:00');

  useEffect(() => {
    const updateRemaining = () => {
      const expires = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, expires - now);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setRemaining(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerText}>{remaining}</Text>
      <Text style={styles.timerLabel}>until unlock</Text>
    </View>
  );
}

export default function SecurityBlockOverlay() {
  const router = useRouter();
  const { isBlocked, blockReason, lockoutExpiresAt, loading } = useSecurity();
  const { theme } = useTheme();
  const isIOS = Platform.OS === 'ios';

  if (!isBlocked || loading) return null;

  const getTitle = () => {
    switch (blockReason) {
      case 'account_locked':
        return isIOS ? 'Account Locked' : 'Account Temporarily Locked';
      case 'suspicious_login_detected':
        return isIOS ? 'Security Alert' : 'Suspicious Activity Detected';
      case 'new_location_detected':
        return 'New Location Detected';
      case 'BLOCK':
        return isIOS ? 'Access Restricted' : 'Login Blocked';
      default:
        return isIOS ? 'Security Check' : 'Access Denied';
    }
  };

  const getMessage = () => {
    switch (blockReason) {
      case 'account_locked':
        return 'Your account has been temporarily locked due to unusual activity.';
      case 'suspicious_login_detected':
        return 'We detected an unusual login attempt from a new location.';
      case 'new_location_detected':
        return 'This login location is different from your usual locations.';
      default:
        return 'For your security, access has been restricted.';
    }
  };

  const handleLogout = () => {
    router.replace('/(auth)/login');
  };

  const handleContactSupport = () => {
    router.push('/support');
  };

  const hasTimer = lockoutExpiresAt && blockReason === 'account_locked';

  if (isIOS) {
    return (
      <SafeAreaView style={styles.containerIOS} edges={['top', 'bottom']}>
        <View style={styles.contentIOS}>
          <View style={styles.iconContainerIOS}>
            <View style={styles.iconCircleIOS}>
              <Icon name="lock-closed" size={40} color="#FF3B30" />
            </View>
          </View>

          <Text style={styles.titleIOS}>{getTitle()}</Text>
          <Text style={styles.messageIOS}>{getMessage()}</Text>

          {hasTimer && lockoutExpiresAt && (
            <CountdownTimer expiresAt={lockoutExpiresAt} />
          )}

          <View style={styles.infoBoxIOS}>
            <Text style={styles.infoBoxTitleIOS}>Why am I seeing this?</Text>
            <Text style={styles.infoBoxTextIOS}>
              Our AI security system analyzes login patterns, locations, and device information to protect your account.
            </Text>
          </View>

          <View style={styles.buttonContainerIOS}>
            <Pressable style={styles.primaryButtonIOS} onPress={handleLogout}>
              <Text style={styles.primaryButtonTextIOS}>Return to Sign In</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonIOS} onPress={handleContactSupport}>
              <Text style={styles.secondaryButtonTextIOS}>Contact Support</Text>
            </Pressable>
          </View>

          <Text style={styles.footerTextIOS}>Need help? Our support team is available 24/7.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.containerAndroid} edges={['top', 'bottom']}>
      <View style={styles.contentAndroid}>
        <View style={styles.iconContainerAndroid}>
          <Icon name="lock-alert" size={72} color="#FF4444" />
        </View>

        <Text style={styles.titleAndroid}>{getTitle()}</Text>
        <Text style={styles.messageAndroid}>{getMessage()}</Text>

        {hasTimer && lockoutExpiresAt && (
          <CountdownTimer expiresAt={lockoutExpiresAt} />
        )}

        <View style={styles.infoCardAndroid}>
          <Text style={styles.infoTitleAndroid}>What's happening?</Text>
          <Text style={styles.infoTextAndroid}>
            Our AI-powered security system detected unusual activity on your account.
            This is a precautionary measure to protect your account and messages.
          </Text>
        </View>

        <View style={styles.buttonContainerAndroid}>
          <Pressable style={[styles.primaryButtonAndroid, { backgroundColor: theme.tint }]} onPress={handleLogout}>
            <Icon name="logout" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonTextAndroid}>Return to Login</Text>
          </Pressable>
          <Pressable style={styles.secondaryButtonAndroid} onPress={handleContactSupport}>
            <Text style={styles.secondaryButtonTextAndroid}>Contact Support</Text>
          </Pressable>
        </View>

        <Text style={styles.footerTextAndroid}>
          If you believe this is a mistake, please contact our support team.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerIOS: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#000',
  },
  contentIOS: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainerIOS: { marginBottom: 28 },
  iconCircleIOS: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIOS: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  messageIOS: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  timerText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FF3B30',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerLabel: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoBoxIOS: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 28,
  },
  infoBoxTitleIOS: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoBoxTextIOS: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 21,
  },
  buttonContainerIOS: { width: '100%', gap: 14 },
  primaryButtonIOS: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonTextIOS: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonIOS: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  secondaryButtonTextIOS: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
  },
  footerTextIOS: {
    marginTop: 28,
    fontSize: 13,
    color: '#636366',
    textAlign: 'center',
  },
  containerAndroid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#121212',
  },
  contentAndroid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainerAndroid: { marginBottom: 24 },
  titleAndroid: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  messageAndroid: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  infoCardAndroid: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  infoTitleAndroid: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoTextAndroid: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  buttonContainerAndroid: { width: '100%', gap: 12 },
  primaryButtonAndroid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonTextAndroid: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonAndroid: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonTextAndroid: {
    color: '#888',
    fontSize: 14,
  },
  footerTextAndroid: {
    marginTop: 24,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
