import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  deep_link?: string;
  priority?: 'default' | 'high';
  category?: string;
  data?: Record<string, string>;
  image_url?: string;
}

async function getFCMAccessToken(serviceAccount: any): Promise<string | null> {
  if (!serviceAccount.client_email || !serviceAccount.private_key) return null;

  try {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const claim = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }));

    const keyText = serviceAccount.private_key.replace(/\\n/g, '\n');
    const base64 = keyText.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);

    const privateKey = await crypto.subtle.importKey(
      'pkcs8', buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
    );

    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' }, privateKey,
      new TextEncoder().encode(`${header}.${claim}`)
    );

    const jwt = `${header}.${claim}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch (e) {
    console.error('[FCM] Token error:', e);
    return null;
  }
}

async function sendFCMCallNotification(
  accessToken: string,
  token: string,
  title: string,
  body: string,
  callerName: string,
  callerId: string,
  callType: string,
  avatar: string,
  deepLink: string,
  projectId: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token,
            android: {
              priority: 'high',
              notification: {
                title: `Incoming ${callType === 'video' ? '📹 Video' : '📞 Audio'} Call`,
                body: `${callerName} is calling...`,
                sound: 'default',
                visibility: 'public',
                click_action: 'android.intent.action.ANSWER',
                ...(imageUrl && { imageUrl }),
              },
              // Native Android CallStyle
              style: {
                type: 'call',
                call: {
                  type: callType === 'video' ? 'VIDEO_CALL' : 'CALL',
                  display_name: callerName,
                  icon: avatar || '',
                },
              },
              // Full screen intent for incoming call
              alert: {
                priority: 'high',
                arrival_time: 'now',
              },
            },
            apns: {
              payload: {
                aps: {
                  'alert': {
                    title: `Incoming ${callType === 'video' ? '📹 Video' : '📞 Audio'} Call`,
                    body: `${callerName} is calling...`,
                  },
                  'category': 'INCOMING_CALL',
                  'content-available': 0,
                  'critical': 1,
                  'sound': 'default.wav',
                },
                ...(imageUrl && { 'media-url': imageUrl }),
              },
            },
            data: {
              type: 'call',
              caller_id: callerId,
              caller_name: callerName,
              call_type: callType,
              deep_link: deepLink,
            },
          },
        }),
      }
    );

    const responseText = await response.text();
    console.log('[FCM] Response:', response.status, responseText);

    if (!response.ok) return { success: false, error: responseText };
    return { success: true };
  } catch (e) {
    console.error('[FCM] Error:', e);
    return { success: false, error: String(e) };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405,
  });

  try {
    const { user_id, title, body, deep_link, priority = 'default', category, data, image_url }: PushPayload = await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server config error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const { data: subscriptions } = await supabaseClient
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const expoToken = subscriptions[0].subscription?.token;
    if (!expoToken) {
      return new Response(JSON.stringify({ success: false, error: 'No token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // Use FCM directly for native Android CallStyle
    if (priority === 'high' && (category === 'call_wake' || category === 'call_incoming')) {
      const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
      const fcmAccessToken = await getFCMAccessToken(serviceAccount);
      
      if (fcmAccessToken && serviceAccount.project_id) {
        console.log('[Push] Sending native FCM CallStyle notification');
        
        const result = await sendFCMCallNotification(
          fcmAccessToken,
          expoToken,
          title,
          body,
          data?.caller_name || 'Unknown',
          data?.caller_id || '',
          data?.call_type || 'video',
          data?.caller_avatar || '',
          deep_link || '',
          serviceAccount.project_id,
          image_url
        );

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        });
      }
    }

    // Fallback to Expo Push API
    const notificationPayload: any = {
      to: expoToken,
      title,
      body,
      data: { ...data, deep_link: deep_link || '', image_url: image_url || '' },
      priority: priority === 'high' ? 'high' : 'default',
      channelId: priority === 'high' ? 'calls' : 'default',
    };

    // Add image URL for Expo Push if provided
    if (image_url) {
      notificationPayload.icon = image_url;
    }

    // Add category for action buttons
    if (category) {
      notificationPayload.categoryId = category;
      console.log('[Push] Category:', category);
    }

    console.log('[Push] Payload:', JSON.stringify(notificationPayload).substring(0, 200));

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(notificationPayload),
    });

    const expoResult = await expoResponse.json();
    return new Response(JSON.stringify({ success: expoResponse.ok, expo: expoResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (e: any) {
    console.error('[Push] Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
