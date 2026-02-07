import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './auth-context';
import { signalingService, SignalingMessage } from '@/services/signaling-service';
import { callService } from '@/services/call-service';
import { useFeatureFlags } from './feature-flag-context';
import { useNotificationActions } from '@/hooks/use-notification-actions';

interface CallContextType {
  isCallInProgress: boolean;
  setIsCallInProgress: (val: boolean) => void;
  incomingCallerId: string | null;
  incomingCallerName: string | null;
  incomingCallType: 'audio' | 'video';
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const router = useRouter();
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [incomingCallerId, setIncomingCallerId] = useState<string | null>(null);
  const [incomingCallerName, setIncomingCallerName] = useState<string | null>(null);
  const [incomingCallType, setIncomingCallType] = useState<'audio' | 'video'>('video');

  const { registerAction } = useNotificationActions();

  // Register notification action handlers
  useEffect(() => {
    registerAction('accept', ({ notification }) => {
      console.log('[Call] User accepted via notification');
      const data = notification?.data as any;
      if (data?.caller_id) {
        setIncomingCallerId(data.caller_id);
        setIncomingCallerName(data.caller_name || 'Unknown');
        setIncomingCallType(data.call_type || 'video');
        setIsCallInProgress(true);
        router.push({
          pathname: '/call/[id]',
          params: {
            id: data.caller_id,
            friendId: data.caller_id,
            friendName: data.caller_name || 'Unknown',
            isIncoming: 'true',
            isVideo: (data.call_type || 'video') === 'video' ? 'true' : 'false',
          }
        });
      }
    });

    registerAction('decline', ({ notification }) => {
      console.log('[Call] User declined via notification');
      // Send decline signal to caller
      const data = notification?.data as any;
      if (data?.caller_id) {
        signalingService.sendMessage({
          type: 'call-declined',
          senderId: user?.id || '',
          targetId: data.caller_id,
          data: { reason: 'user_declined' }
        });
      }
    });

    registerAction('busy', ({ notification }) => {
      console.log('[Call] User marked busy via notification');
      const data = notification?.data as any;
      if (data?.caller_id) {
        signalingService.sendMessage({
          type: 'busy',
          senderId: user?.id || '',
          targetId: data.caller_id,
          data: {}
        });
      }
    });
  }, [registerAction, user, router]);

  const acceptIncomingCall = useCallback(() => {
    setIsCallInProgress(true);
  }, []);

  const declineIncomingCall = useCallback(() => {
    setIncomingCallerId(null);
    setIncomingCallerName(null);
    setIsCallInProgress(false);
  }, []);

  useEffect(() => {
    if (flagsLoading) return;

    console.log(`[CallContext] Checking setup. User: ${user?.id}, Supported: ${callService.isSupported()}, Enabled: ${isEnabled('ENABLE_CALLING')}`);

    if (user && callService.isSupported() && isEnabled('ENABLE_CALLING')) {
      console.log(`[CallContext] Setting up call service for user ${user.id}`);
      callService.setup(user.id);
      
      const handleIncomingSignal = (message: SignalingMessage) => {
        console.log('Incoming signal:', message.type, 'from:', message.senderId);
        if (message.type === 'offer' && !isCallInProgress) {
          const isVideoCall = message.data?.isVideo || false;
          setIncomingCallerId(message.senderId);
          setIncomingCallerName(message.senderName || 'Unknown');
          setIncomingCallType(isVideoCall ? 'video' : 'audio');
          
          // Navigate to CallScreen for incoming call
          router.push({
            pathname: '/call/[id]',
            params: {
              id: message.senderId,
              friendId: message.senderId,
              friendName: message.senderName || 'Unknown',
              friendAvatar: message.senderAvatar,
              isIncoming: 'true',
              isVideo: isVideoCall ? 'true' : 'false',
            }
          });
        }
      };

      signalingService.subscribe(user.id, handleIncomingSignal);
      
      return () => {
        signalingService.unsubscribe(handleIncomingSignal);
      };
    }
  }, [user, isCallInProgress, flagsLoading, isEnabled, router]);

  return (
    <CallContext.Provider value={{ 
      isCallInProgress, 
      setIsCallInProgress,
      incomingCallerId,
      incomingCallerName,
      incomingCallType,
      acceptIncomingCall,
      declineIncomingCall
    } as any}>
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
