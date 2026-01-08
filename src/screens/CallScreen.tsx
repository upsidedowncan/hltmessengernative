import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/MainNavigator';
import { callService } from '../services/CallService';
import { signalingService, SignalingMessage } from '../services/SignalingService';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useFeatureFlags } from '../context/FeatureFlagContext';
import { useCall } from '../context/CallContext';
import { Audio } from 'expo-av';

type CallScreenRouteProp = RouteProp<MainStackParamList, 'Call'>;

export const CallScreen = () => {
  const route = useRoute<CallScreenRouteProp>();
  const navigation = useNavigation();
  const { friendId, friendName, isIncoming } = route.params;
  const { theme, isDarkMode } = useAppTheme();
  const { user, profile } = useAuth();
  const { setIsCallInProgress } = useCall() as any;
  
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'Incoming...' : 'Calling...');
  const [isMuted, setIsMuted] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(!isIncoming);
  
  const ringingSoundRef = useRef<Audio.Sound | null>(null);

  const playRinging = async () => {
    if (isIncoming) return;
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/phone/phone-calling-1b.mp3' },
        { isLooping: true, shouldPlay: true, volume: 0.5 }
      );
      ringingSoundRef.current = newSound;
    } catch (e) {
      console.log('Error playing ringing sound', e);
    }
  };

  const stopRinging = async () => {
    if (ringingSoundRef.current) {
      try {
        await ringingSoundRef.current.stopAsync();
        await ringingSoundRef.current.unloadAsync();
      } catch (e) {
        // Ignore
      }
      ringingSoundRef.current = null;
    }
  };

  useEffect(() => {
    setIsCallInProgress(true);
    if (!isIncoming) playRinging();

    if (!callService.isSupported()) {
      navigation.goBack();
      return;
    }

    callService.setCallbacks(
      (stream) => {
        console.log('Native remote stream received');
        setRemoteStream(stream);
        setCallStatus('Connected');
        stopRinging();
      },
      () => {
        setIsCallInProgress(false);
        stopRinging();
        navigation.goBack();
      }
    );

    if (!isIncoming) {
      callService.startCall(friendId, profile?.full_name || profile?.username || 'Unknown');
    }

    return () => {
      setIsCallInProgress(false);
      stopRinging();
      callService.endCall();
    };
  }, []);

  const handleAnswer = async () => {
    setHasAnswered(true);
    setCallStatus('Connecting...');
    await callService.acceptCall();
  };

  const handleDecline = () => {
    callService.endCall();
    navigation.goBack();
  };

  const handleHangup = () => {
    callService.endCall();
    navigation.goBack();
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    // Add mute logic to callService if needed
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#f2f2f7' }]}>
      <View style={styles.content}>
        <View style={styles.userInfo}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.tint }]}>
            <Text style={styles.avatarText}>{friendName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{friendName}</Text>
          <Text style={[styles.status, { color: theme.tabIconDefault }]}>{callStatus}</Text>
        </View>

        {callStatus === 'Connected' && (
           <View style={styles.timerContainer}>
              <ActivityIndicator size="small" color={theme.tint} />
           </View>
        )}
      </View>

      <View style={styles.controls}>
        {!hasAnswered ? (
          <>
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: '#FF3B30' }]} 
              onPress={handleDecline}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: '#4CD964' }]} 
              onPress={handleAnswer}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: isMuted ? theme.tint : 'rgba(255,255,255,0.1)' }]} 
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? "#fff" : theme.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: '#FF3B30' }]} 
              onPress={handleHangup}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userInfo: { alignItems: 'center', marginBottom: 50 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarText: { color: '#fff', fontSize: 48, fontWeight: 'bold' },
  userName: { fontSize: 24, fontWeight: '600', marginBottom: 10 },
  status: { fontSize: 18 },
  timerContainer: { marginTop: 20 },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingBottom: 50 },
  controlButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
});