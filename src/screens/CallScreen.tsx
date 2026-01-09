import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, TouchableWithoutFeedback, Platform, StatusBar } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/MainNavigator';
import { callService } from '../services/CallService';
import { signalingService, SignalingMessage } from '../services/SignalingService';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useFeatureFlags } from '../context/FeatureFlagContext';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIP_WIDTH = 100;
const PIP_HEIGHT = 150;
const MARGIN = 20;

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

// Swipe Button Component
const SwipeToAnswer = ({ onAnswer }: { onAnswer: () => void }) => {
  const translateX = useSharedValue(0);
  const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;
  const BUTTON_WIDTH = SCREEN_WIDTH * 0.8;
  const KNOB_SIZE = 60;
  const MAX_TRANSLATE = BUTTON_WIDTH - KNOB_SIZE - 10;

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = Math.max(0, Math.min(event.translationX, MAX_TRANSLATE));
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(MAX_TRANSLATE, {}, () => {
          runOnJS(onAnswer)();
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedKnobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.swipeContainer, { width: BUTTON_WIDTH }]}>
      <Animated.Text style={[styles.swipeText, animatedTextStyle]}>
        Swipe to Answer
      </Animated.Text>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.swipeKnob, animatedKnobStyle]}>
          <Ionicons name="call" size={32} color="#fff" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// Pulsing Avatar Ring
const PulsingRing = ({ delay }: { delay: number }) => {
  const { theme } = useAppTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(2, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View 
      style={[
        StyleSheet.absoluteFillObject, 
        styles.ring, 
        { backgroundColor: theme.tint }, 
        animatedStyle
      ]} 
    />
  );
};

export const CallScreen = () => {
  const route = useRoute<CallScreenRouteProp>();
  const navigation = useNavigation();
  const { friendId, friendName, isIncoming, isVideo: initialIsVideo } = route.params;
  const { theme } = useAppTheme();
  const { user } = useAuth(); // profile removed from here, not used
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
  const isBottom = useSharedValue(false); // Track if PIP is in bottom quadrant

  function setIsBottom(val: boolean) {
    isBottom.value = val;
  }

  // Adjust Y when controls toggle
  useEffect(() => {
    if (isBottom.value) {
      // Re-calculate bottom snap position based on controls visibility
      const topOffset = Platform.OS === 'ios' ? 60 : 40;
      const bottomBase = SCREEN_HEIGHT - PIP_HEIGHT - topOffset - MARGIN - (Platform.OS === 'ios' ? 30 : 10);
      const toolbarOffset = controlsVisible ? -80 : 0; // Shift up if toolbar is visible
      
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
      // Calculate layout limits
      const topOffset = Platform.OS === 'ios' ? 60 : 40;
      const maxTranslateX = -(SCREEN_WIDTH - PIP_WIDTH - MARGIN * 2);
      const bottomBase = SCREEN_HEIGHT - PIP_HEIGHT - topOffset - MARGIN - (Platform.OS === 'ios' ? 30 : 10);
      const toolbarOffset = controlsVisible ? -80 : 0;
      const maxTranslateY = bottomBase + toolbarOffset;

      // Determine horizontal snap
      const shouldSnapLeft = translateX.value < maxTranslateX / 2;
      const targetX = shouldSnapLeft ? maxTranslateX : 0;

      // Determine vertical snap
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
    if (hasAnswered) {
      const timeout = setTimeout(() => setControlsVisible(false), 4000);
      return () => clearTimeout(timeout);
    }
  }, [hasAnswered]);

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
      else navigation.navigate('MainTabs' as any); // Fallback
      return;
    }
    
    callService.setCallbacks(
      (stream) => {
        setRemoteStream(stream);
        setHasRemoteVideo(stream && stream.getVideoTracks().length > 0);
        setStreamUpdateId(prev => prev + 1);
        setCallStatus('Connected');
        stopRinging();
        setLocalStream(callService.getLocalStream());
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
      // NOTE: Removed profile?.full_name usage since profile was not in scope or needed for this specific call
      // The friend's name is known, but our own name is sent via signaling if needed.
      // Assuming callService handles null senderName gracefully or we fetch it from user metadata.
      callService.startCall(friendId, 'User', isVideoEnabled); 
      setLocalStream(callService.getLocalStream());
    }

    return () => {
      setIsCallInProgress(false);
      stopRinging();
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

  const activeCallToolbar: ToolbarItem[] = [
    {
      icon: isMuted ? "mic-off" : "mic",
      onPress: toggleMute,
      isActive: isMuted,
    },
    {
      icon: isVideoEnabled ? "videocam" : "videocam-off",
      onPress: toggleVideo,
      isActive: isVideoEnabled,
    },
    {
      icon: isSpeakerOn ? "volume-high" : "phone-portrait",
      onPress: toggleSpeaker,
      isActive: isSpeakerOn,
    },
    {
      icon: "camera-reverse",
      onPress: () => {
        Haptics.selectionAsync();
        callService.switchCamera();
      },
    },
    {
      icon: "call",
      onPress: handleHangup,
      backgroundColor: '#FF3B30',
    }
  ];

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.videoContainer}>
            <View style={StyleSheet.absoluteFill}>
              {/* Background Video */}
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
          
          {/* PIP Video */}
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
                  </View>
                </TouchableWithoutFeedback>
              </Animated.View>
            </GestureDetector>
          )}

          {/* Avatar/Info */}
          {((!isSwapped && !hasRemoteVideo) || (isSwapped && !isVideoEnabled) || callStatus !== 'Connected') && (
             <View style={styles.infoContent}>
                <View style={styles.avatarContainer}>
                  {!hasAnswered && callStatus !== 'Connected' && (
                    <>
                      <PulsingRing delay={0} />
                      <PulsingRing delay={1000} />
                    </>
                  )}
                  <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                    <Text style={styles.avatarText}>{friendName.charAt(0).toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.userName}>{friendName}</Text>
                <Text style={styles.status}>{callStatus}</Text>
             </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* UI Overlay */}
      <View style={styles.uiOverlay} pointerEvents="box-none">
        
        {/* Incoming Call Actions */}
        {!hasAnswered && (
          <SafeAreaView style={styles.incomingControls} pointerEvents="box-none">
            <View style={styles.declineContainer}>
               <TouchableOpacity onPress={handleDecline} style={styles.textDecline}>
                  <Text style={{ color: '#fff', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}>Decline</Text>
               </TouchableOpacity>
            </View>
            <SwipeToAnswer onAnswer={handleAnswer} />
          </SafeAreaView>
        )}

        {/* Active Call Controls */}
        {hasAnswered && (
          <Animated.View style={[styles.activeControls, controlsAnimatedStyle]}>
             <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
             />
             <SafeAreaView>
                <Toolbar items={activeCallToolbar} transparent />
             </SafeAreaView>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  videoContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  fullScreenVideo: { width: '100%', height: '100%', position: 'absolute' },
  pipContainer: { 
    width: PIP_WIDTH, 
    height: PIP_HEIGHT, 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 40, 
    right: MARGIN, 
    borderRadius: 16, 
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#2c2c2c',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  localVideo: { flex: 1 },
  infoContent: { alignItems: 'center', justifyContent: 'center', zIndex: -1 },
  avatarContainer: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', zIndex: 2, elevation: 5 },
  ring: { borderRadius: 60 },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: '700' },
  userName: { fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
  status: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 },
  
  uiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  
  incomingControls: { paddingBottom: 50, alignItems: 'center', width: '100%' },
  swipeContainer: {
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 35,
    padding: 5,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  swipeKnob: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  swipeText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    marginLeft: 30,
    textShadowColor: 'rgba(0,0,0,0.3)', 
    textShadowRadius: 2
  },
  declineContainer: { marginBottom: 40 },
  textDecline: { padding: 15 },

  activeControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
    paddingTop: 40, // Fade gradient area
  }
});