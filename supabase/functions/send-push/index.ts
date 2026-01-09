import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"
import webpush from "https://esm.sh/web-push@3.6.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Lightweight JWT Signer for Google Auth
async function getAccessToken(serviceAccount: any) {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const keyText = serviceAccount.private_key.replace(/\\n/g, '\n');
  const privateKey = await ArrayBufferFromPEM(keyText);

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(`${header}.${claim}`)
  );

  const jwt = `${header}.${claim}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  return data.access_token;
}

async function ArrayBufferFromPEM(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  
  return await crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user_id, title, body, deep_link } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // WEB PUSH
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    // FCM V1
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
    let fcmAccessToken = '';
    if (serviceAccount.project_id) {
        fcmAccessToken = await getAccessToken(serviceAccount);
    }

    const { data: subscriptions } = await supabaseClient
        .from('push_subscriptions')
        .select('subscription, id')
        .eq('user_id', user_id)

    if (!subscriptions?.length) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })

    const promises = subscriptions.map(async (sub) => {
        try {
            if (sub.subscription.endpoint) {
                await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, deep_link }));
            } else if (fcmAccessToken && sub.subscription.token) {
                await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${fcmAccessToken}`
                    },
                    body: JSON.stringify({
                        message: {
                            token: sub.subscription.token,
                            notification: { title, body },
                            data: { deep_link },
                            android: { priority: 'high' }
                        }
                    })
                });
            }
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id);
            }
        }
    });

    await Promise.all(promises);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})