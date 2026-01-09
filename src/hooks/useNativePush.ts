import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../services/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNativePush() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus>();

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
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

      // Get the token (FCM for Android, APNs for iOS)
      // Note: For FCM direct usage in Edge Function, we might need getDevicePushTokenAsync
      // But for simplicity with Expo backend, we stick to standard tokens or FCM strings.
      // Here we grab the Expo token which wraps FCM.
      // If we want raw FCM:
      try {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          const token = tokenData.data;
          setExpoPushToken(token);
          await saveTokenToSupabase(token);
      } catch (e) {
          console.error("Error getting push token", e);
      }
    }
  }

  async function saveTokenToSupabase(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Save as { token: "..." } to distinguish from Web Push format
    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription: { token: token, platform: Platform.OS } 
    }, { onConflict: 'subscription' }); // This relies on unique constraint on subscription col
    
    // Fallback if upsert fails on constraint:
    // Ideally we query first.
  }

  return { expoPushToken, permissionStatus };
}