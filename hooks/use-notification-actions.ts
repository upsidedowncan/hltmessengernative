import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/services/supabase';

export type NotificationAction = {
  id: string;
  title: string;
  input?: boolean;
  options?: {
    opensApp?: boolean;
    destructive?: boolean;
    foreground?: boolean;
  };
};

export type NotificationCategory = {
  id: string;
  actions: NotificationAction[];
};

// Define notification categories for Android/iOS
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: 'call_incoming',
    actions: [
      {
        id: 'accept',
        title: 'Accept',
        options: { opensApp: true, foreground: true },
      },
      {
        id: 'decline',
        title: 'Decline',
        options: { destructive: true, opensApp: false },
      },
      {
        id: 'busy',
        title: 'Busy',
        options: { destructive: true, opensApp: false },
      },
    ],
  },
  {
    id: 'chat_message',
    actions: [
      {
        id: 'reply',
        title: 'Reply',
        input: true,
        options: { opensApp: true, foreground: true },
      },
      {
        id: 'mark_read',
        title: 'Mark Read',
        options: { opensApp: false },
      },
    ],
  },
  {
    id: 'friend_request',
    actions: [
      {
        id: 'accept',
        title: 'Accept',
        options: { opensApp: true },
      },
      {
        id: 'decline',
        title: 'Decline',
        options: { destructive: true, opensApp: false },
      },
    ],
  },
  {
    id: 'missed_call',
    actions: [
      {
        id: 'callback',
        title: 'Call Back',
        options: { opensApp: true },
      },
      {
        id: 'message',
        title: 'Send Message',
        options: { opensApp: true },
      },
    ],
  },
];

export function useNotificationCategories() {
  const setupCategories = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      console.log('[Notifications] Setting up categories for:', Platform.OS);

      // For Android, we need to define actions differently
      if (Platform.OS === 'android') {
        // Android-specific action buttons
        await Notifications.setNotificationCategoryAsync('call_incoming', [
          {
            identifier: 'accept',
            buttonTitle: 'Accept',
            options: {
              opensApp: true,
              isDestructiveAction: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'decline',
            buttonTitle: 'Decline',
            options: {
              opensApp: false,
              isDestructiveAction: true,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'busy',
            buttonTitle: 'Busy',
            options: {
              opensApp: false,
              isDestructiveAction: true,
              isAuthenticationRequired: false,
            },
          },
        ] as any);

        await Notifications.setNotificationCategoryAsync('chat_message', [
          {
            identifier: 'reply',
            buttonTitle: 'Reply',
            textInputAction: {
              submitButtonTitle: 'Send',
              placeholder: 'Reply...',
            },
            options: {
              opensApp: true,
              isDestructiveAction: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'mark_read',
            buttonTitle: 'Mark Read',
            options: {
              opensApp: false,
              isDestructiveAction: false,
              isAuthenticationRequired: false,
            },
          },
        ] as any);

        await Notifications.setNotificationCategoryAsync('friend_request', [
          {
            identifier: 'accept',
            buttonTitle: 'Accept',
            options: {
              opensApp: true,
              isDestructiveAction: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'decline',
            buttonTitle: 'Decline',
            options: {
              opensApp: false,
              isDestructiveAction: true,
              isAuthenticationRequired: false,
            },
          },
        ] as any);

        await Notifications.setNotificationCategoryAsync('missed_call', [
          {
            identifier: 'callback',
            buttonTitle: 'Call Back',
            options: {
              opensApp: true,
              isDestructiveAction: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'message',
            buttonTitle: 'Message',
            options: {
              opensApp: true,
              isDestructiveAction: false,
              isAuthenticationRequired: false,
            },
          },
        ] as any);

        console.log('[Notifications] Android categories registered');
      } else {
        // iOS categories
        const categories = NOTIFICATION_CATEGORIES.map(cat => ({
          categoryId: cat.id,
          actions: cat.actions.map(action => ({
            buttonTitle: action.title,
            identifier: action.id,
            textInputAction: action.input ? {
              placeholder: 'Reply...',
            } : undefined,
            options: {
              opensApp: action.options?.opensApp ?? true,
              isDestructiveAction: action.options?.destructive ?? false,
              isAuthenticationRequired: false,
            },
          })),
        }));

        for (const category of categories) {
          await Notifications.setNotificationCategoryAsync(
            category.categoryId,
            category.actions as any
          );
          console.log('[Notifications] Registered iOS category:', category.categoryId);
        }
      }
      
      // Save to database for cross-device sync
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        for (const cat of NOTIFICATION_CATEGORIES) {
          await supabase.from('notification_categories').upsert({
            user_id: user.id,
            category_id: cat.id,
            actions: cat.actions,
          }, { onConflict: 'user_id,category_id' });
        }
      }
    } catch (e) {
      console.error('[Notifications] Failed to setup categories:', e);
    }
  }, []);

  useEffect(() => {
    setupCategories();
  }, [setupCategories]);

  return { setupCategories, categories: NOTIFICATION_CATEGORIES };
}

// Hook for handling notification actions
export function useNotificationActions() {
  const actionHandlers = useRef<Map<string, (data?: any) => void>>(new Map());

  const registerAction = useCallback((actionId: string, handler: (data?: any) => void) => {
    actionHandlers.current.set(actionId, handler);
  }, []);

  const unregisterAction = useCallback((actionId: string) => {
    actionHandlers.current.delete(actionId);
  }, []);

  const handleAction = useCallback((notification: Notifications.NotificationResponse) => {
    const actionId = notification.actionIdentifier;
    const input = (notification as any).userText;

    console.log('[Notifications] Action received:', actionId, input);

    const handler = actionHandlers.current.get(actionId);
    if (handler) {
      handler({ input, notification: notification.notification.request.content });
    }
  }, []);

  return {
    registerAction,
    unregisterAction,
    handleAction,
  };
}

// Send a call notification
export async function sendCallNotification({
  userId,
  callerName,
  callerId,
  callType = 'video',
  deepLink,
}: {
  userId: string;
  callerName: string;
  callerId: string;
  callType?: 'audio' | 'video';
  deepLink?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  return await supabase.functions.invoke('send-push', {
    body: {
      user_id: userId,
      title: 'Incoming Call',
      body: `${callerName} is calling you...`,
      deep_link: deepLink || `swift://call/${callerId}?type=${callType}`,
      priority: 'high',
      category: 'call_incoming',
      data: {
        type: 'call',
        caller_id: callerId,
        caller_name: callerName,
        call_type: callType,
        action: 'incoming',
      },
    },
  });
}

// Send a message notification
export async function sendMessageNotification({
  userId,
  senderName,
  senderId,
  messagePreview,
  chatId,
}: {
  userId: string;
  senderName: string;
  senderId: string;
  messagePreview: string;
  chatId: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  return await supabase.functions.invoke('send-push', {
    body: {
      user_id: userId,
      title: senderName,
      body: messagePreview,
      deep_link: `swift://chat/${chatId}`,
      category: 'chat_message',
      data: {
        type: 'message',
        sender_id: senderId,
        chat_id: chatId,
      },
    },
  });
}

// Send a friend request notification
export async function sendFriendRequestNotification({
  userId,
  requesterName,
  requesterId,
}: {
  userId: string;
  requesterName: string;
  requesterId: string;
}) {
  return await supabase.functions.invoke('send-push', {
    body: {
      user_id: userId,
      title: 'New Friend Request',
      body: `${requesterName} sent you a friend request`,
      deep_link: 'swift://friends',
      category: 'friend_request',
      data: {
        type: 'friend_request',
        requester_id: requesterId,
      },
    },
  });
}
