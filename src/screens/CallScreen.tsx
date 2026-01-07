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
import { WebCallBridge, WebCallBridgeHandle } from '../components/WebCallBridge';
import { Audio } from 'expo-av';

let MediaStream: any;
let RTCView: any;
try {
  const WebRTC = require('react-native-webrtc');
  MediaStream = WebRTC.MediaStream;
  RTCView = WebRTC.RTCView;
} catch (e) {
  // Not available
}

type CallScreenRouteProp = RouteProp<MainStackParamList, 'Call'>;

export const CallScreen = () => {
  const route = useRoute<CallScreenRouteProp>();
  const navigation = useNavigation();
  const { friendId, friendName, isIncoming } = route.params;
  const { theme, isDarkMode } = useAppTheme();
  const { isEnabled } = useFeatureFlags();
  const { user, profile } = useAuth();
  const { setIsCallInProgress } = useCall() as any;
  
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'Incoming...' : 'Calling...');
  const [isMuted, setIsMuted] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(!isIncoming);
  
  const webBridgeRef = useRef<WebCallBridgeHandle>(null);
  const ringingSoundRef = useRef<Audio.Sound | null>(null);
  const readyHeartbeatRef = useRef<any>(null);
  const isWebMode = !callService.isSupported() && isEnabled('ENABLE_WEB_CALLING');
  const peerReadyReceived = useRef(false);

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

  const stopHeartbeat = () => {
    if (readyHeartbeatRef.current) {
      clearInterval(readyHeartbeatRef.current);
      readyHeartbeatRef.current = null;
    }
  };

  useEffect(() => {
    setIsCallInProgress(true);
    if (!isIncoming) playRinging();

    const handleSignal = (msg: SignalingMessage) => {
      if (msg.type === 'peer-ready' && msg.senderId === friendId) {
        if (!peerReadyReceived.current) {
          console.log('Recipient is ready! Starting PeerJS call.');
          peerReadyReceived.current = true;
          webBridgeRef.current?.startCall(friendId);
        }
      }
    };
    signalingService.subscribe(user?.id || '', handleSignal);

    if (!isWebMode) {
      if (!callService.isSupported()) {
        navigation.goBack();
        return;
      }
      callService.setCallbacks(
        (stream) => {
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
    } else {
      if (!isIncoming) {
        signalingService.sendSignal(friendId, {
          type: 'offer',
          senderId: user?.id || '',
          senderName: profile?.full_name || profile?.username || 'Unknown',
          data: { webMode: true }
        });
      }
    }

    return () => {
      setIsCallInProgress(false);
      stopRinging();
      stopHeartbeat();
      signalingService.unsubscribe(handleSignal);
      if (!isWebMode) callService.endCall();
      else webBridgeRef.current?.endCall();
    };
  }, []);

  const startWebCallWithRetry = (friendId: string, attempts = 0) => {
    if (peerReadyReceived.current) return;

    if (attempts > 15) { // 30 seconds total
      setCallStatus('Peer Unavailable');
      return;
    }
    
    console.log(`Waiting for recipient bridge... attempt ${attempts + 1}`);
    
    setTimeout(() => {
      if (callStatus !== 'Connected' && !isIncoming && !peerReadyReceived.current) {
        startWebCallWithRetry(friendId, attempts + 1);
      }
    }, 2000);
  };

  const handleAnswer = async () => {
    setHasAnswered(true);
    setCallStatus('Connecting...');
    if (isWebMode) {
      webBridgeRef.current?.acceptCall();
    } else {
      await callService.acceptCall();
    }
  };

  const handleDecline = () => {
    if (isWebMode) webBridgeRef.current?.endCall();
    else callService.endCall();
    navigation.goBack();
  };

  const handleHangup = () => {
    if (isWebMode) webBridgeRef.current?.endCall();
    else callService.endCall();
    navigation.goBack();
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (isWebMode) webBridgeRef.current?.toggleMute(nextMuted);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#f2f2f7' }]}>
      {isWebMode && user && (
        <WebCallBridge 
          ref={webBridgeRef}
          userId={user.id}
          onStatusChange={(status) => {
             if (status === 'Ready' && !isIncoming) {
                startWebCallWithRetry(friendId);
             }
          }}
          onReady={() => {
            if (isIncoming) {
              stopHeartbeat();
              const sendReady = () => {
                if (callStatus !== 'Connected') {
                  signalingService.sendSignal(friendId, {
                    type: 'peer-ready',
                    senderId: user.id
                  });
                } else {
                  stopHeartbeat();
                }
              };
              sendReady();
              readyHeartbeatRef.current = setInterval(sendReady, 2000);
            }
          }}
          onRemoteStream={() => {
            setCallStatus('Connected');
            stopRinging();
            stopHeartbeat();
          }}
          onCallEnd={() => {
            setIsCallInProgress(false);
            stopRinging();
            stopHeartbeat();
            navigation.goBack();
          }}
        />
      )}
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
