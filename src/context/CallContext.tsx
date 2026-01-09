import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { signalingService, SignalingMessage } from '../services/SignalingService';
import { callService } from '../services/CallService';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/MainNavigator';

import { featureFlagService } from '../services/FeatureFlagService';
import { useFeatureFlags } from './FeatureFlagContext';

interface CallContextType {
  isCallInProgress: boolean;
  setIsCallInProgress: (val: boolean) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [isCallInProgress, setIsCallInProgress] = useState(false);

  useEffect(() => {
    if (flagsLoading) return;

    console.log(`[CallContext] Checking setup. User: ${user?.id}, Supported: ${callService.isSupported()}, Enabled: ${isEnabled('ENABLE_CALLING')}`);

    if (user && callService.isSupported() && isEnabled('ENABLE_CALLING')) {
      console.log(`[CallContext] Setting up call service for user ${user.id}`);
      callService.setup(user.id);
      
      const handleIncomingSignal = (message: SignalingMessage) => {
        console.log('Incoming signal:', message.type, 'from:', message.senderId);
        if (message.type === 'offer' && !isCallInProgress) {
          setIsCallInProgress(true);
          const isVideoCall = message.data?.isVideo || false;
          // Navigate to CallScreen for incoming call
          navigation.navigate('Call', {
            friendId: message.senderId,
            friendName: message.senderName || 'Unknown',
            isIncoming: true,
            isVideo: isVideoCall,
          });
        }
      };

      signalingService.subscribe(user.id, handleIncomingSignal);
      
      return () => {
        signalingService.unsubscribe(handleIncomingSignal);
      };
    }
  }, [user, isCallInProgress, flagsLoading, isEnabled]);

  return (
    <CallContext.Provider value={{ isCallInProgress, setIsCallInProgress } as any}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
