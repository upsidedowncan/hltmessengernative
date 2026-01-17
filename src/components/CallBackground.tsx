import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  useAnimatedStyle,
  interpolateColor,
  withTiming, 
  withSequence,
  withRepeat,
  Easing
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const CallBackground = ({ volume = 0 }: { volume?: number }) => {
  // Amplitudes for 3 simulated harmonics
  const amp1 = useSharedValue(0);
  const amp2 = useSharedValue(0);
  const amp3 = useSharedValue(0);
  const volumeValue = useSharedValue(0);

  // Phases to make it move
  const phase = useSharedValue(0);

  useEffect(() => {
    // Continuous phase animation for "drift"
    phase.value = withRepeat(withTiming(Math.PI * 10, { duration: 10000, easing: Easing.linear }), -1);
  }, []);

  useEffect(() => {
    // When volume changes, boost amplitudes
    // Map volume (0..1) to amplitude pixels
    const targetAmp = Math.max(volume * 150, 5); // Minimum 5px vibration even at silence for "aliveness"
    
    // Animate to new amplitude
    amp1.value = withTiming(targetAmp, { duration: 100 });
    amp2.value = withTiming(targetAmp * 0.6, { duration: 100 });
    amp3.value = withTiming(targetAmp * 0.3, { duration: 100 });
    volumeValue.value = withTiming(volume, { duration: 100 });

  }, [volume]);

  const backgroundStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        volumeValue.value,
        [0, 1],
        ['#8BA294', '#FF3B30']
      ),
    };
  });

  const animatedProps = useAnimatedProps(() => {
    const points = [];
    const segments = 40;
    const startY = height / 2;
    
    points.push(`M 0 ${startY}`);

    for (let i = 1; i <= segments; i++) {
      const x = (width / segments) * i;
      const progress = i / segments; // 0 to 1
      
      // Pin ends: sin(progress * PI) is 0 at start/end, 1 in center
      const envelope = Math.sin(progress * Math.PI);

      // Waves
      // 1. Fundamental
      const y1 = Math.sin(progress * Math.PI * 1 + phase.value * 2) * amp1.value;
      // 2. Harmonic
      const y2 = Math.sin(progress * Math.PI * 3 + phase.value * 3) * amp2.value;
      // 3. Noise/Jitter
      const y3 = Math.sin(progress * Math.PI * 7 + phase.value * 5) * amp3.value;

      const totalY = startY + (y1 + y2 + y3) * envelope;
      
      points.push(`L ${x} ${totalY}`);
    }

    return {
      d: points.join(' '),
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="stringGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="rgba(255,255,255,0.1)" />
            <Stop offset="0.5" stopColor="rgba(255,255,255,0.9)" />
            <Stop offset="1" stopColor="rgba(255,255,255,0.1)" />
          </LinearGradient>
        </Defs>

        {/* Main String */}
        <AnimatedPath
          animatedProps={animatedProps}
          stroke="url(#stringGrad)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glow / Echo String (Thicker, more transparent) */}
        <AnimatedPath
          animatedProps={animatedProps}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.6 }} // Use style for opacity to avoid props conflict if any
        />
      </Svg>
    </Animated.View>
  );
};