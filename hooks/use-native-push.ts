import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/services/supabase';

// Event emitter for incoming calls
type IncomingCallData = {
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
};

const callListeners = new Set<(data: IncomingCallData) => void>();

export function addCallListener(callback: (data: IncomingCallData) => void) {
  callListeners.add(callback);
  return () => callListeners.delete(callback);
}

function emitIncomingCall(data: IncomingCallData) {
  callListeners.forEach(cb => cb(data));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android notification categories - MUST match what push sends
async function setupNotificationCategories() {
  if (Platform.OS !== 'android') return;

  console.log('[Push] Setting up notification categories...');

  try {
    // chat_message - Reply/Mark Read
    await Notifications.setNotificationCategoryAsync('chat_message', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        textInputAction: { submitButtonTitle: 'Send', placeholder: 'Reply...' },
        options: { opensApp: true, isDestructiveAction: false },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark Read',
        options: { opensApp: false, isDestructiveAction: false },
      },
    ] as any);
    console.log('[Push] Registered: chat_message');

    // friend_request - Accept/Decline
    await Notifications.setNotificationCategoryAsync('friend_request', [
      {
        identifier: 'accept',
        buttonTitle: 'Accept',
        options: { opensApp: true, isDestructiveAction: false },
      },
      {
        identifier: 'decline',
        buttonTitle: 'Decline',
        options: { opensApp: false, isDestructiveAction: true },
      },
    ] as any);
    console.log('[Push] Registered: friend_request');

    // missed_call - Call Back/Message
    await Notifications.setNotificationCategoryAsync('missed_call', [
      {
        identifier: 'callback',
        buttonTitle: 'Call Back',
        options: { opensApp: true, isDestructiveAction: false },
      },
      {
        identifier: 'message',
        buttonTitle: 'Message',
        options: { opensApp: true, isDestructiveAction: false },
      },
    ] as any);
    console.log('[Push] Registered: missed_call');

    // call_wake - for incoming calls (push wakes app)
    await Notifications.setNotificationCategoryAsync('call_wake', [
      {
        identifier: 'ACCEPT_CALL',
        buttonTitle: 'Accept',
        options: { opensApp: true, isDestructiveAction: false },
      },
      {
        identifier: 'DECLINE_CALL',
        buttonTitle: 'Decline',
        options: { opensApp: false, isDestructiveAction: true },
      },
    ] as any);
    console.log('[Push] Registered: call_wake');

    console.log('[Push] All categories ready');
  } catch (e) {
    console.error('[Push] Failed setup:', e);
  }
}

export function useNativePush() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus>();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Handle notification actions
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    console.log('[Push] Notification response:', response.actionIdentifier);
    
    const data = response.notification.request.content.data as any;
    const action = response.actionIdentifier;

    // Handle call actions
    if (action === 'accept' && data?.caller_id) {
      console.log('[Push] User accepted call from:', data.caller_id);
      // Navigate to call screen
    } else if (action === 'decline' || action === 'busy') {
      console.log('[Push] User declined/busy call');
    }
    
    // Handle chat reply
    if (action === 'reply' && data?.chat_id) {
      console.log('[Push] User replied to chat:', data.chat_id);
      const userText = (response as any).userText;
      console.log('[Push] Reply text:', userText);
    }
    
    // Handle mark read
    if (action === 'mark_read' && data?.chat_id) {
      console.log('[Push] User marked chat as read:', data.chat_id);
    }

    const deepLink = data?.deep_link;
    if (deepLink) {
      console.log('[Push] Would navigate to:', deepLink);
    }
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Push] Notification received:', notification.request.content.title);
      
      const data = notification.request.content.data as any;
      if (data?.type === 'call' || data?.type === 'incoming_call') {
        console.log('[Push] Incoming call notification detected');
        emitIncomingCall({
          callerId: data?.caller_id || 'unknown',
          callerName: data?.caller_name || 'Unknown',
          callType: (data?.call_type as 'audio' | 'video') || 'video',
        });
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [handleNotificationResponse]);

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return;

    // Setup notification channels and categories
    await setupNotificationCategories();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#4CAF50',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      setPermissionStatus(finalStatus);
      
      if (finalStatus !== 'granted') {
        return;
      }

      try {
        const projectId = '326af801-e711-4fd7-8959-91fa53f740e0';
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const token = tokenData.data;
        console.log('[Push] Got Expo push token:', token?.substring(0, 20) + '...');
        setExpoPushToken(token);
        await saveTokenToSupabase(token);
      } catch (e) {
        console.error("[Push] Error getting push token", e);
      }
    }
  }

  async function saveTokenToSupabase(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[Push] No user, skipping token save');
      return;
    }

    console.log('[Push] Saving token for user:', user.id);

    try {
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          subscription: { token, platform: Platform.OS },
          platform: Platform.OS
        });

      if (insertError) {
        console.log('[Push] Insert failed:', insertError.message);
        
        if (insertError.code === '23505') {
          console.log('[Push] Token already exists');
        } else {
          await supabase
            .from('push_subscriptions')
            .update({
              subscription: { token, platform: Platform.OS },
              platform: Platform.OS,
              updated_at: new Date().toISOString()
            })
            .eq('subscription->>token', token);
          console.log('[Push] Token updated');
        }
      } else {
        console.log('[Push] Token saved');
      }
      
      const { data: verify } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (verify) {
        console.log('[Push] Verification: token exists');
      }
    } catch (e) {
      console.error('[Push] Error:', e);
    }
  }

  return { expoPushToken, permissionStatus };
}
