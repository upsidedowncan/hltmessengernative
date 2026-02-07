import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/services/supabase';

export type CallNotificationState = {
  isShowing: boolean;
  callerId: string | null;
  callerName: string | null;
  callType: 'audio' | 'video';
};

// Configure notification handler for foreground calls
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useCallNotifications() {
  const callStateRef = useRef<CallNotificationState>({
    isShowing: false,
    callerId: null,
    callerName: null,
    callType: 'video',
  });

  // Setup notification channels and categories
  useEffect(() => {
    async function setup() {
      if (Platform.OS === 'web') return;

      console.log('[CallNotif] Setting up channels and categories...');

      // Android: High-priority call channel with heads-up display
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#4CAF50',
      });

      // Android: Call category with Accept/Decline buttons
      if (Platform.OS === 'android') {
        await Notifications.setNotificationCategoryAsync('call_wake', [
          {
            identifier: 'ACCEPT_CALL',
            buttonTitle: 'Accept',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'DECLINE_CALL',
            buttonTitle: 'Decline',
            options: { opensAppToForeground: false },
          },
        ] as any);
        console.log('[CallNotif] Android categories registered');
      } else {
        // iOS categories
        await Notifications.setNotificationCategoryAsync('call_wake', [
          {
            identifier: 'ACCEPT_CALL',
            buttonTitle: 'Accept',
            options: { opensApp: true },
          },
          {
            identifier: 'DECLINE_CALL',
            buttonTitle: 'Decline',
            options: { opensApp: false, isDestructiveAction: true },
          },
        ] as any);
        console.log('[CallNotif] iOS categories registered');
      }
    }

    setup();
  }, []);

  // Show incoming call notification (local - this creates native CallStyle UI!)
  const showIncomingCall = useCallback(async (callerId: string, callerName: string, callType: 'audio' | 'video') => {
    if (Platform.OS === 'web') return;

    console.log('[CallNotif] Showing incoming call:', callerName);

    callStateRef.current = {
      isShowing: true,
      callerId,
      callerName,
      callType,
    };

    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Incoming ${callType === 'video' ? '📹 Video' : '📞 Audio'} Call`,
        body: `${callerName} is calling...`,
        data: {
          type: 'incoming_call',
          caller_id: callerId,
          caller_name: callerName,
          call_type: callType,
        },
        categoryIdentifier: 'call_wake',
        priority: Notifications.AndroidNotificationPriority.MAX,
        sound: 'default',
        sticky: true,
      },
      trigger: null,
    });

    console.log('[CallNotif] Call notification scheduled');
  }, []);

  // Cancel incoming call
  const cancelCall = useCallback(async () => {
    if (Platform.OS === 'web') return;

    console.log('[CallNotif] Canceling call');
    await Notifications.cancelAllScheduledNotificationsAsync();
    callStateRef.current = { isShowing: false, callerId: null, callerName: null, callType: 'video' };
  }, []);

  // Dismiss notification
  const dismissCall = useCallback(async () => {
    if (Platform.OS === 'web') return;
    await Notifications.dismissAllNotificationsAsync();
    callStateRef.current = { isShowing: false, callerId: null, callerName: null, callType: 'video' };
  }, []);

  // Handle notification interactions (button presses)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      const data = response.notification.request.content.data as any;

      console.log('[CallNotif] User action:', action, data);

      if (action === 'ACCEPT_CALL' || action === 'DEFAULT_ACTION_IDENTIFIER') {
        console.log('[CallNotif] User ACCEPTED call from:', data?.caller_id);
        callStateRef.current.isShowing = false;
      } else if (action === 'DECLINE_CALL') {
        console.log('[CallNotif] User DECLINED call');
        callStateRef.current = { isShowing: false, callerId: null, callerName: null, callType: 'video' };
      }
    });

    return () => subscription.remove();
  }, []);

  return {
    showIncomingCall,
    cancelCall,
    dismissCall,
    callState: callStateRef.current,
  };
}

// Send push notification to wake up the app (doesn't show CallStyle)
// The receiving app then shows the local CallStyle notification
export async function sendCallPushNotification({
  recipientUserId,
  callerId,
  callerName,
  callType = 'video',
}: {
  recipientUserId: string;
  callerId: string;
  callerName: string;
  callType?: 'audio' | 'video';
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  return await supabase.functions.invoke('send-push', {
    body: {
      user_id: recipientUserId,
      title: '📞',
      body: 'call',
      priority: 'high',
      category: 'call_wake',
      data: {
        type: 'incoming_call',
        caller_id: callerId,
        caller_name: callerName,
        call_type: callType,
        action: 'wake',
      },
    },
  });
}
