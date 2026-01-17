import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, TouchableWithoutFeedback, Platform, StatusBar } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/MainNavigator';
import { callService } from '../services/CallService';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/FeatureFlagContext';
import { useCall } from '../context/CallContext';
import { Audio } from 'expo-av';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
  withRepeat,
  withDelay
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Toolbar, ToolbarItem } from '../components/Toolbar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { CallBackground } from '../components/CallBackground';

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
  // Not available
}

type CallScreenRouteProp = RouteProp<MainStackParamList, 'Call'>;

// --- Components ---

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
      <Text style={styles.timerText}>{formatTime(duration)}</Text>
    </View>
  );
};

// Samsung Style Swipe Up Button for Incoming Call
const SwipeUpButton = ({ 
  type, 
  onTrigger 
}: { 
  type: 'answer' | 'decline'; 
  onTrigger: () => void 
}) => {
  const translateY = useSharedValue(0);
  const SWIPE_THRESHOLD = -80; // Negative because up is negative Y
  const isAnswer = type === 'answer';
  const baseColor = isAnswer ? '#34C759' : '#FF3B30';
  
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow dragging up (negative Y)
      translateY.value = Math.min(0, Math.max(event.translationY, SWIPE_THRESHOLD * 1.5));
    })
    .onEnd(() => {
      if (translateY.value < SWIPE_THRESHOLD) {
        translateY.value = withTiming(SWIPE_THRESHOLD * 2, { duration: 200 }, () => {
          runOnJS(onTrigger)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, SWIPE_THRESHOLD], [1, 0.5]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SWIPE_THRESHOLD/2], [0.3, 0]),
    transform: [{ scale: interpolate(translateY.value, [0, SWIPE_THRESHOLD], [1, 1.5]) }]
  }));
  
  const Container = Platform.OS === 'ios' ? BlurView : View;
  const containerProps = Platform.OS === 'ios' ? { intensity: 20, tint: 'light' as const } : {};

  return (
    <View style={styles.swipeBtnWrapper}>
       {/* Visual Trail/Hint */}
       <View style={styles.swipeTrack}>
          <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.5)" style={{ marginBottom: -5 }} />
          <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.3)" />
       </View>

       <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.swipeBtnContainer, animatedStyle]}>
             <Container 
                style={[
                   styles.swipeBtnCircle, 
                   { backgroundColor: isAnswer ? 'rgba(52, 199, 89, 0.8)' : 'rgba(255, 59, 48, 0.8)' }
                ]} 
                {...containerProps}
             >
                {isAnswer ? (
                  <Ionicons name="call" size={32} color="#fff" />
                ) : (
                  <MaterialIcons name="call-end" size={32} color="#fff" />
                )}
             </Container>
             {/* Pulsing ring behind (optional flair) */}
             <Animated.View style={[
                StyleSheet.absoluteFillObject, 
                styles.swipeBtnRing, 
                { borderColor: baseColor },
                ringStyle
             ]} />
          </Animated.View>
       </GestureDetector>
    </View>
  );
};

export const CallScreen = () => {
  const route = useRoute<CallScreenRouteProp>();
  const navigation = useNavigation();
  const { friendId, friendName, friendAvatar, isIncoming, isVideo: initialIsVideo } = route.params;
  const { theme } = useAppTheme();
  const { profile: userProfile } = useAuth(); // Get user profile
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
  
  const ringingSoundRef = useRef<Audio.Sound | null>(null);
  
  // Controls Animation
  const controlsTranslateY = useSharedValue(0);

  useEffect(() => {
    controlsTranslateY.value = withTiming(controlsVisible ? 0 : 200, {
      duration: 300,
      easing: Easing.inOut(Easing.ease),
    });
  }, [controlsVisible]);

  // PIP Dragging values (Initially Top-Right)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // PIP Snap Logic
  const isBottom = useSharedValue(false);

  function setIsBottom(val: boolean) {
    isBottom.value = val;
  }

  useEffect(() => {
    if (isBottom.value) {
      const topOffset = Platform.OS === 'ios' ? 60 : 40;
      const bottomBase = SCREEN_HEIGHT - PIP_HEIGHT - topOffset - MARGIN - (Platform.OS === 'ios' ? 30 : 10);
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
      const topOffset = Platform.OS === 'ios' ? 60 : 40;
      const maxTranslateX = -(SCREEN_WIDTH - PIP_WIDTH - MARGIN * 2);
      const bottomBase = SCREEN_HEIGHT - PIP_HEIGHT - topOffset - MARGIN - (Platform.OS === 'ios' ? 30 : 10);
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
        // Ignore
      }
      ringingSoundRef.current = null;
    }
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
    if (!isIncoming) playRinging();

    if (!callService.isSupported()) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MainTabs' as any);
      return;
    }
    
    // Use user's real name or fallback
    const myName = userProfile?.full_name || 'User';
    const myAvatar = userProfile?.avatar_url || undefined;

    callService.setCallbacks(
      (stream) => {
        setRemoteStream(stream);
        setHasRemoteVideo(stream && stream.getVideoTracks().length > 0);
        setStreamUpdateId(prev => prev + 1);
        setCallStatus('Connected');
        stopRinging();
        setLocalStream(callService.getLocalStream());
        // Start monitoring volume for visualizer
        callService.startVolumeMonitoring((vol) => {
           setRemoteVolume(vol);
        });
      },
      () => {
        setIsCallInProgress(false);
        stopRinging();
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('MainTabs' as any);
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
      callService.stopVolumeMonitoring(); // Ensure we stop polling
      callService.endCall();
    };
  }, []);

  const handleAnswer = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasAnswered(true);
    setCallStatus('Connecting...');
    await callService.acceptCall(isVideoEnabled);
    setLocalStream(callService.getLocalStream());
  };

  const handleDecline = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    callService.endCall();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs' as any);
  };

  const handleHangup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    callService.endCall();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs' as any);
  };

  const toggleMute = () => {
    Haptics.selectionAsync();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    callService.toggleAudio(!nextMuted);
  };

  const toggleVideo = () => {
    Haptics.selectionAsync();
    const nextVideo = !isVideoEnabled;
    setIsVideoEnabled(nextVideo);
    callService.toggleVideo(nextVideo);
  };

  const toggleSpeaker = async () => {
    Haptics.selectionAsync();
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
    Haptics.selectionAsync();
    setIsSwapped(!isSwapped);
  };

  const ActiveCallControls = () => (
    <View style={styles.activeCallBar}>
      <TouchableOpacity 
        style={[styles.controlBtn, styles.controlBtnLeft, isMuted && styles.controlBtnActive]} 
        onPress={toggleMute}
      >
        <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? "#000" : "#fff"} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.controlBtn, isVideoEnabled === false && styles.controlBtnActive]} 
        onPress={toggleVideo}
      >
        <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={28} color={!isVideoEnabled ? "#000" : "#fff"} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]} 
        onPress={toggleSpeaker}
      >
        <Ionicons name={isSpeakerOn ? "volume-high" : "ear-outline"} size={28} color={isSpeakerOn ? "#000" : "#fff"} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.controlBtn, styles.hangupBtn]} 
        onPress={handleHangup}
      >
         <MaterialIcons name="call-end" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.videoContainer}>
            {/* Background Layer */}
            <View style={StyleSheet.absoluteFill}>
               <CallBackground volume={remoteVolume} />
            </View>

            {/* Video Layer (Only shown if video is present) */}
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
          
          {/* PIP Video (Local by default, Remote if swapped) */}
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
                    {/* Mute Indicator on PIP */}
                    {!isSwapped && isMuted && (
                       <View style={styles.pipMuteOverlay}>
                          <Ionicons name="mic-off" size={16} color="#fff" />
                       </View>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </Animated.View>
            </GestureDetector>
          )}

          {/* Avatar/Info (Shown when not connected or no video) */}
          {((!isSwapped && !hasRemoteVideo) || (isSwapped && !isVideoEnabled) || callStatus !== 'Connected') && (
             <View style={styles.infoContent}>
                <Text style={styles.userName}>{friendName}</Text>
             </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* UI Overlay */}
      <View style={styles.uiOverlay} pointerEvents="box-none">
        
        {/* Top Section */}
        {hasAnswered && (
          <Animated.View style={[styles.topBar, controlsAnimatedStyle]}>
             <SafeAreaView />
          </Animated.View>
        )}

        {/* Incoming Call Actions - SAMSUNG STYLE */}
        {!hasAnswered && (
          <SafeAreaView style={styles.incomingControls} pointerEvents="box-none">
             <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {friendAvatar ? (
                    <Image source={{ uri: friendAvatar }} style={styles.incomingAvatar} />
                ) : (
                    <View style={[styles.incomingAvatar, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 40, color: '#fff', fontWeight: 'bold' }}>{friendName.charAt(0)}</Text>
                    </View>
                )}
                <Text style={styles.incomingName}>{friendName}</Text>
                <Text style={styles.incomingStatus}>Incoming call...</Text>
             </View>
            <View style={styles.samsungControls}>
              <SwipeUpButton type="decline" onTrigger={handleDecline} />
              <SwipeUpButton type="answer" onTrigger={handleAnswer} />
            </View>
          </SafeAreaView>
        )}

        {/* Active Call Controls */}
        {hasAnswered && (
          <Animated.View style={[styles.activeControls, controlsAnimatedStyle]}>
             <View style={styles.timerContainerDesign}>
                 {callStatus === 'Connected' ? <CallDuration isActive={true} /> : <Text style={styles.statusText}>{callStatus}</Text>}
             </View>
             
             <SafeAreaView style={{ alignItems: 'center' }}>
                <ActiveCallControls />
             </SafeAreaView>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#8BA294' },
  videoContainer: { ...StyleSheet.absoluteFillObject },
  fullScreenVideo: { width: '100%', height: '100%', position: 'absolute' },
  
  pipContainer: { 
    width: PIP_WIDTH, 
    height: PIP_HEIGHT, 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 40, 
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
    top: 367, // From CSS top: 367px
    width: '100%', 
    alignItems: 'center', 
    zIndex: -1 
  },
  userName: { 
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter', 
    fontSize: 43.6, 
    fontWeight: '400', 
    color: '#FFFFFF', 
    textAlign: 'center',
  },
  
  uiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  
  topBar: {
    width: '100%',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0,
  },
  
  timerWrapper: {},
  timerText: { 
    color: '#fff', 
    fontSize: 31.6, // From CSS font-size: 31.5987px
    fontWeight: '400', 
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '500', 
  },

  timerContainerDesign: {
      marginBottom: 38, // 834 (top of buttons) - 789 (top of timer) - 38 (height of timer) = 7px ? CSS says top 789, buttons top 834. Gap is 834 - 789 - 38 = 7px.
      alignItems: 'center',
  },

  incomingControls: { paddingBottom: 50, alignItems: 'center', width: '100%', justifyContent: 'flex-end', flex: 1 },
  incomingAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20 },
  incomingName: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 10 },
  incomingStatus: { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
  samsungControls: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 60, marginTop: 60 },
  swipeBtnWrapper: { alignItems: 'center' },
  swipeTrack: { position: 'absolute', top: -30, alignItems: 'center' },
  swipeBtnContainer: {  },
  swipeBtnCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  swipeBtnRing: { borderRadius: 35, borderWidth: 2 },

  activeControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 14, // Safe area + margin
    left: 19, 
    right: 19,
  },
  activeCallBar: {
    flexDirection: 'row',
    height: 78,
    width: '100%',
  },
  controlBtn: {
    width: 78,
    height: 78,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 60, 60, 0.7)',
  },
  controlBtnLeft: {
    borderTopLeftRadius: 13,
    borderBottomLeftRadius: 13,
  },
  hangupBtn: {
    flex: 1, // To fill the rest (two 78px blocks)
    backgroundColor: 'rgba(233, 52, 52, 0.7)',
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
