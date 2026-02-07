import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TouchableWithoutFeedback, Platform, StatusBar, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { callService } from '@/services/call-service';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useCall } from '@/contexts/call-context';
import { CallBackground } from '@/components/call-background';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { interpolate } from 'react-native-reanimated';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Appbar, IconButton, Text as RNPText, Surface, FAB, ProgressBar, Button } from 'react-native-paper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIP_WIDTH = 110;
const PIP_HEIGHT = 160;
const MARGIN = 16;

let MediaStream: any;
let RTCView: any;
try {
  const WebRTC = require('react-native-webrtc');
  MediaStream = WebRTC.MediaStream;
  RTCView = WebRTC.RTCView;
} catch (e) {
}

const CallDuration = ({ isActive }: { isActive: boolean }) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive) return null;

  return (
    <View style={styles.timerWrapper}>
      <RNPText variant="headlineMedium" style={styles.timerText}>{formatTime(duration)}</RNPText>
    </View>
  );
};

export default function CallScreenAndroid() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendId = params.friendId as string;
  const friendName = params.friendName as string;
  const friendAvatar = params.friendAvatar as string | undefined;
  const isIncoming = params.isIncoming === 'true';
  const initialIsVideo = params.isVideo === 'true';
  const isVideo = initialIsVideo;

  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  const { profile: userProfile } = useAuth();
  const { setIsCallInProgress } = useCall() as any;
  
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [streamUpdateId, setStreamUpdateId] = useState(0);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'Incoming Call' : 'Calling...');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialIsVideo || false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(initialIsVideo || false);
  const [hasAnswered, setHasAnswered] = useState(!isIncoming);
  const [isSwapped, setIsSwapped] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [remoteVolume, setRemoteVolume] = useState(0);
  const [callTimeout, setCallTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const ringingSoundRef = useRef<Audio.Sound | null>(null);
  
  const controlsTranslateY = useSharedValue(0);

  useEffect(() => {
    controlsTranslateY.value = withTiming(controlsVisible ? 0 : 200, {
      duration: 300,
      easing: Easing.inOut(Easing.ease),
    });
  }, [controlsVisible]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  const isBottom = useSharedValue(false);

  function setIsBottom(val: boolean) {
    isBottom.value = val;
  }

  useEffect(() => {
    if (isBottom.value) {
      const topOffset = 40;
      const bottomBase = SCREEN_HEIGHT - PIP_HEIGHT - topOffset - MARGIN - 10;
      const toolbarOffset = controlsVisible ? -90 : 0;
      
      translateY.value = withSpring(bottomBase + toolbarOffset, { damping: 25, stiffness: 150 });
    }
  }, [controlsVisible]);

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;
    })
    .onEnd(() => {
      const topOffset = 40;
      const maxTranslateX = -(SCREEN_WIDTH - PIP_WIDTH - MARGIN * 2);
      const bottomBase = SCREEN_HEIGHT - PIP_HEIGHT - topOffset - MARGIN - 10;
      const toolbarOffset = controlsVisible ? -90 : 0;
      const maxTranslateY = bottomBase + toolbarOffset;

      const shouldSnapLeft = translateX.value < maxTranslateX / 2;
      const targetX = shouldSnapLeft ? maxTranslateX : 0;

      const shouldSnapBottom = translateY.value > maxTranslateY / 2;
      const targetY = shouldSnapBottom ? maxTranslateY : 0;
      
      runOnJS(setIsBottom)(shouldSnapBottom);

      translateX.value = withSpring(targetX, { damping: 25, stiffness: 150 });
      translateY.value = withSpring(targetY, { damping: 25, stiffness: 150 });
    });

  const pipStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: controlsTranslateY.value }],
    opacity: interpolate(controlsTranslateY.value, [0, 50], [1, 0]),
  }));

  useEffect(() => {
    if (hasAnswered && callStatus === 'Connected') {
      const timeout = setTimeout(() => setControlsVisible(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [hasAnswered, callStatus]);

  const toggleControls = () => {
    setControlsVisible(!controlsVisible);
  };

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
      }
      ringingSoundRef.current = null;
    }
  };

  const startCallTimeout = () => {
    const timeout = setTimeout(() => {
      if (!hasAnswered) {
        handleDecline();
      }
    }, 60000);
    setCallTimeout(timeout);
  };

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: !isVideoEnabled,
        });
      } catch (e) {
        console.log('Error configuring audio', e);
      }
    };
    configureAudio();

    setIsCallInProgress(true);
    if (!isIncoming) {
      playRinging();
      startCallTimeout();
    }

    if (!callService.isSupported()) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/chats');
      return;
    }
    
    const myName = userProfile?.full_name || 'User';
    const myAvatar = userProfile?.avatar_url || undefined;

    callService.setCallbacks(
      (stream) => {
        setRemoteStream(stream);
        setHasRemoteVideo(stream && stream.getVideoTracks().length > 0);
        setStreamUpdateId(prev => prev + 1);
        setCallStatus('Connected');
        stopRinging();
        if (callTimeout) {
          clearTimeout(callTimeout);
          setCallTimeout(null);
        }
        setLocalStream(callService.getLocalStream());
        callService.startVolumeMonitoring((vol) => {
           setRemoteVolume(vol);
        });
      },
      () => {
        setIsCallInProgress(false);
        stopRinging();
        if (callTimeout) {
          clearTimeout(callTimeout);
          setCallTimeout(null);
        }
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/chats');
      },
      (stream) => {
        setLocalStream(stream);
      }
    );

    if (!isIncoming) {
      callService.startCall(friendId, myName, myAvatar, isVideoEnabled); 
      setLocalStream(callService.getLocalStream());
    }

    return () => {
      setIsCallInProgress(false);
      stopRinging();
      if (callTimeout) {
        clearTimeout(callTimeout);
        setCallTimeout(null);
      }
      callService.stopVolumeMonitoring();
      callService.endCall();
    };
  }, []);

  const handleAnswer = async () => {
    setHasAnswered(true);
    setCallStatus('Connecting...');
    if (callTimeout) {
      clearTimeout(callTimeout);
      setCallTimeout(null);
    }
    await callService.acceptCall(isVideoEnabled);
    setLocalStream(callService.getLocalStream());
  };

  const handleDecline = () => {
    callService.endCall();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chats');
  };

  const handleHangup = () => {
    callService.endCall();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chats');
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    callService.toggleAudio(!nextMuted);
  };

  const toggleVideo = () => {
    const nextVideo = !isVideoEnabled;
    setIsVideoEnabled(nextVideo);
    callService.toggleVideo(nextVideo);
  };

  const toggleSpeaker = async () => {
    const nextSpeakerOn = !isSpeakerOn;
    setIsSpeakerOn(nextSpeakerOn);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: !nextSpeakerOn,
      });
    } catch (e) {
      console.log('Error toggling speaker', e);
    }
  };

  const swapVideoViews = () => {
    setIsSwapped(!isSwapped);
  };

  const M3Button = ({ 
    icon, 
    onPress, 
    isActive = false,
    isRed = false 
  }: { 
    icon: string; 
    onPress: () => void;
    isActive?: boolean;
    isRed?: boolean;
  }) => {
    const backgroundColor = isRed 
      ? '#F44336' 
      : isActive 
        ? m3.secondaryContainer 
        : 'rgba(60, 60, 60, 0.7)';
    const iconColor = isRed || isActive ? m3.onSecondaryContainer : '#fff';
    
    return (
      <Surface style={[styles.m3ControlBtn, { backgroundColor }]} elevation={isActive ? 2 : 0}>
        <TouchableOpacity onPress={onPress} style={styles.m3ControlBtnInner}>
          <MaterialIcons name={icon as any} size={28} color={iconColor} />
        </TouchableOpacity>
      </Surface>
    );
  };

  const HangupButton = () => (
    <Surface style={[styles.m3HangupBtn, { backgroundColor: '#F44336' }]} elevation={4}>
      <TouchableOpacity onPress={handleHangup} style={styles.m3HangupBtnInner}>
        <MaterialIcons name="call-end" size={32} color="#fff" />
      </TouchableOpacity>
    </Surface>
  );

  const ActiveCallControls = () => (
    <View style={styles.m3ControlsRow}>
      <M3Button 
        icon={isMuted ? "mic-off" : "mic"} 
        onPress={toggleMute}
        isActive={isMuted}
      />
      <M3Button 
        icon={isVideoEnabled ? "videocam" : "videocam-off"} 
        onPress={toggleVideo}
        isActive={!isVideoEnabled}
      />
      <M3Button 
        icon={isSpeakerOn ? "volume-high" : "earpiece"} 
        onPress={toggleSpeaker}
        isActive={isSpeakerOn}
      />
      <HangupButton />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.videoContainer}>
            <View style={StyleSheet.absoluteFill}>
               <CallBackground volume={remoteVolume} />
            </View>

            <View style={StyleSheet.absoluteFill}>
              {RTCView && (
                isSwapped ? (
                  localStream && isVideoEnabled && (
                    <RTCView key={`local-bg-${streamUpdateId}`} streamURL={localStream.toURL()} style={styles.fullScreenVideo} objectFit="cover" mirror={true} />
                  )
                ) : (
                  remoteStream && hasRemoteVideo && (
                    <RTCView key={`remote-bg-${streamUpdateId}`} streamURL={remoteStream.toURL()} style={styles.fullScreenVideo} objectFit="cover" />
                  )
                )
              )}
            </View>
          
          {((localStream && !isSwapped && isVideoEnabled) || (remoteStream && isSwapped && hasRemoteVideo)) && RTCView && (
            <GestureDetector gesture={dragGesture}>
              <Animated.View style={[styles.pipContainer, pipStyle]}>
                <TouchableWithoutFeedback onPress={swapVideoViews}>
                  <View style={{ flex: 1 }}>
                    <RTCView
                      key={`pip-${streamUpdateId}`}
                      streamURL={isSwapped ? remoteStream.toURL() : localStream.toURL()}
                      style={styles.localVideo}
                      objectFit="cover"
                      mirror={!isSwapped}
                      zOrder={1}
                    />
                    {!isSwapped && isMuted && (
                       <View style={styles.pipMuteOverlay}>
                          <MaterialIcons name="mic-off" size={16} color="#fff" />
                       </View>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </Animated.View>
            </GestureDetector>
          )}

          {((!isSwapped && !hasRemoteVideo) || (isSwapped && !isVideoEnabled) || callStatus !== 'Connected') && (
             <View style={styles.infoContent}>
                <Surface style={[styles.avatarContainer, { backgroundColor: m3.primaryContainer }]} elevation={2}>
                  {friendAvatar ? (
                    <Image source={{ uri: friendAvatar }} style={styles.avatarImage} />
                  ) : (
                    <RNPText variant="displayMedium" style={{ color: m3.onPrimaryContainer, fontWeight: 'bold' }}>
                      {friendName.charAt(0)}
                    </RNPText>
                  )}
                </Surface>
                <RNPText variant="headlineMedium" style={[styles.userName, { color: '#fff' }]}>{friendName}</RNPText>
                {!isVideo && (
                  <Surface style={[styles.audioCallBadge, { backgroundColor: 'rgba(0,0,0,0.4)' }]} elevation={0}>
                    <MaterialIcons name="call" size={16} color="#fff" />
                    <RNPText variant="labelMedium" style={{ color: '#fff', marginLeft: 4 }}>Audio Call</RNPText>
                  </Surface>
                )}
                {callStatus === 'Connected' ? (
                  <CallDuration isActive={true} />
                ) : (
                  <RNPText variant="bodyLarge" style={[styles.statusText, { color: 'rgba(255,255,255,0.8)' }]}>{callStatus}</RNPText>
                )}
             </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.uiOverlay} pointerEvents="box-none">
        {hasAnswered && (
          <Animated.View style={[styles.topBar, controlsAnimatedStyle]}>
             <SafeAreaView />
          </Animated.View>
        )}

        {!hasAnswered && (
          <SafeAreaView style={styles.incomingControls} pointerEvents="box-none">
             <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Surface style={[styles.incomingAvatar, { backgroundColor: m3.primaryContainer }]} elevation={3}>
                  {friendAvatar ? (
                    <Image source={{ uri: friendAvatar }} style={styles.avatarImage} />
                  ) : (
                    <RNPText variant="displaySmall" style={{ color: m3.onPrimaryContainer, fontWeight: 'bold' }}>
                      {friendName.charAt(0)}
                    </RNPText>
                  )}
                </Surface>
                <RNPText variant="headlineMedium" style={[styles.incomingName, { color: '#fff' }]}>{friendName}</RNPText>
                {!isVideo && (
                  <Surface style={[styles.audioCallBadge, { backgroundColor: 'rgba(0,0,0,0.4)' }]} elevation={0}>
                    <MaterialIcons name="call" size={16} color="#fff" />
                    <RNPText variant="labelMedium" style={{ color: '#fff', marginLeft: 4 }}>Audio Call</RNPText>
                  </Surface>
                )}
                <RNPText variant="bodyLarge" style={[styles.incomingStatus, { color: 'rgba(255,255,255,0.8)' }]}>
                  {isIncoming ? 'Incoming call...' : 'Calling...'}
                </RNPText>
             </View>
            
            <View style={styles.m3ButtonRow}>
              <Button
                mode="contained"
                onPress={handleDecline}
                style={[styles.m3DeclineButton, { backgroundColor: '#F44336' }]}
                contentStyle={styles.m3DeclineContent}
              >
                <MaterialIcons name="call-end" size={24} color="#fff" />
              </Button>
              
              <Button
                mode="contained"
                onPress={handleAnswer}
                style={[styles.m3AnswerButton, { backgroundColor: '#4CAF50' }]}
                contentStyle={styles.m3AnswerContent}
              >
                <MaterialIcons name="call" size={24} color="#fff" />
              </Button>
            </View>
          </SafeAreaView>
        )}

        {hasAnswered && (
          <Animated.View style={[styles.activeControls, controlsAnimatedStyle]}>
             <SafeAreaView style={{ alignItems: 'center', width: '100%' }}>
                <ActiveCallControls />
             </SafeAreaView>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  videoContainer: { ...StyleSheet.absoluteFillObject },
  fullScreenVideo: { width: '100%', height: '100%', position: 'absolute' },
  
  pipContainer: { 
    width: PIP_WIDTH, 
    height: PIP_HEIGHT, 
    position: 'absolute', 
    top: 40, 
    right: MARGIN, 
    borderRadius: 16, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#2c2c2c',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  localVideo: { flex: 1 },
  pipMuteOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 4,
  },

  infoContent: { 
    position: 'absolute', 
    top: 200,
    width: '100%', 
    alignItems: 'center', 
    zIndex: -1 
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  userName: { 
    textAlign: 'center',
    marginBottom: 8,
  },
  audioCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  callTypeText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  
  uiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  
  topBar: {
    width: '100%',
    paddingTop: StatusBar.currentHeight || 20,
  },
  
  timerWrapper: {
    marginBottom: 8,
  },
  timerText: { 
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    marginTop: 8,
  },

  incomingControls: { paddingBottom: 50, alignItems: 'center', width: '100%', justifyContent: 'flex-end', flex: 1 },
  incomingAvatar: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  incomingName: { fontSize: 32, fontWeight: '700', marginBottom: 12 },
  incomingStatus: { fontSize: 18, marginBottom: 16 },
  
  m3ButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    marginTop: 40,
  },
  m3DeclineButton: {
    borderRadius: 50,
    width: 70,
    height: 70,
  },
  m3DeclineContent: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },
  m3AnswerButton: {
    borderRadius: 50,
    width: 70,
    height: 70,
  },
  m3AnswerContent: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },

  activeControls: {
    position: 'absolute',
    bottom: 14, 
    left: 19, 
    right: 19,
  },
  
  m3ControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  m3ControlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  m3ControlBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  m3HangupBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  m3HangupBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
