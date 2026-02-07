import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginContext {
  user_id: string;
  user_email: string;
  ip_address: string;
  user_agent: string;
  device_fingerprint?: string;
}

interface LocationData {
  ip: string;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  country_code: string;
  org: string;
  asn: string;
}

interface TrustedLocation {
  id: string;
  ip_address: string;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  country_code: string;
  trust_score: number;
  login_count: number;
  last_login_at: string;
}

interface SecuritySettings {
  location_tracking_enabled: boolean;
  max_trusted_locations: number;
  lockout_duration_hours: number;
  anomaly_threshold: number;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const cerebrasApiKey = Deno.env.get('CEREBRAS_API_KEY') || '';

    const loginContext: LoginContext = await req.json();

    if (!loginContext.user_id || !loginContext.ip_address) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: 'invalid_request',
        message: 'Missing required fields'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Check for active lockout
    const lockoutCheck = await fetch(
      `${supabaseUrl}/rest/v1/account_lockouts?user_id=eq.${loginContext.user_id}&released_at=is.null&expires_at=gt.${new Date().toISOString()}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    if (!lockoutCheck.ok) {
      throw new Error('Failed to check lockout status');
    }

    const lockouts = await lockoutCheck.json();

    if (lockouts && lockouts.length > 0) {
      const lockout = lockouts[0];
      return new Response(JSON.stringify({
        allowed: false,
        reason: 'account_locked',
        expires_at: lockout.expires_at,
        message: `Account temporarily locked. Try again after ${new Date(lockout.expires_at).toLocaleString()}`
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Get user's security settings
    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_security_settings?user_id=eq.${loginContext.user_id}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    let userSettings: SecuritySettings = {
      location_tracking_enabled: true,
      max_trusted_locations: 5,
      lockout_duration_hours: 24,
      anomaly_threshold: 0.75
    };

    if (settingsRes.ok) {
      const settingsData = await settingsRes.json();
      if (settingsData && settingsData.length > 0) {
        userSettings = { ...userSettings, ...settingsData[0] };
      }
    }

    // Skip location tracking if disabled
    if (!userSettings.location_tracking_enabled) {
      return new Response(JSON.stringify({
        allowed: true,
        reason: 'location_tracking_disabled'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Get IP geolocation using geojs.io (free, no API key needed)
    let currentLocation: LocationData;
    try {
      const geoRes = await fetch(`https://get.geojs.io/v1/ip/geo/${loginContext.ip_address}.json`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Swift-Messenger-Security/1.0'
        }
      });

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        currentLocation = {
          ip: geoData.ip || loginContext.ip_address,
          latitude: parseFloat(geoData.latitude) || 0,
          longitude: parseFloat(geoData.longitude) || 0,
          city: geoData.city || 'Unknown',
          region: geoData.region || 'Unknown',
          country: geoData.country || 'Unknown',
          country_code: geoData.country_code || 'XX',
          org: geoData.organization_name || 'Unknown',
          asn: geoData.asn?.toString() || 'Unknown'
        };
      } else {
        throw new Error('Geolocation API failed');
      }
    } catch (geoError) {
      console.error('Geolocation error:', geoError);
      // Fallback if geolocation fails
      currentLocation = {
        ip: loginContext.ip_address,
        latitude: 0,
        longitude: 0,
        city: 'Unknown',
        region: 'Unknown',
        country: 'Unknown',
        country_code: 'XX',
        org: 'Unknown',
        asn: 'Unknown'
      };
    }

    // 4. Get user's trusted locations
    const trustedRes = await fetch(
      `${supabaseUrl}/rest/v1/user_trusted_locations?user_id=eq.${loginContext.user_id}&order=login_count.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    let trustedLocations: TrustedLocation[] = [];
    if (trustedRes.ok) {
      const data = await trustedRes.json();
      trustedLocations = data || [];
    }

    // 5. Get recent login attempts (last 24 hours)
    const recentAttemptsRes = await fetch(
      `${supabaseUrl}/rest/v1/login_attempts?user_id=eq.${loginContext.user_id}&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&order=created_at.desc&limit=10`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    let recentAttempts: any[] = [];
    if (recentAttemptsRes.ok) {
      const data = await recentAttemptsRes.json();
      recentAttempts = data || [];
    }

    // 6. Calculate distance to nearest trusted location
    let minDistance = Infinity;
    let isTrustedIP = false;

    if (trustedLocations.length > 0) {
      for (const loc of trustedLocations) {
        const dist = haversineDistance(
          currentLocation.latitude, currentLocation.longitude,
          loc.latitude, loc.longitude
        );
        if (dist < minDistance) {
          minDistance = dist;
        }
        if (loc.ip_address === loginContext.ip_address) {
          isTrustedIP = true;
        }
      }
    }

    // 7. AI Anomaly Detection using Cerebras/Wafer Provider
    const aiAnalysis = await analyzeWithAI(
      cerebrasApiKey,
      loginContext,
      currentLocation,
      trustedLocations,
      minDistance,
      recentAttempts  // ADD THIS
    );

    // 8. Make decision
    const decision = makeDecision(aiAnalysis, userSettings, minDistance, isTrustedIP, recentAttempts);

    // 9. Log the attempt
    await logLoginAttempt(supabaseUrl, supabaseKey, {
      user_id: loginContext.user_id,
      ip_address: loginContext.ip_address,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      city: currentLocation.city,
      region: currentLocation.region,
      country: currentLocation.country,
      country_code: currentLocation.country_code,
      user_agent: loginContext.user_agent,
      trusted_location: minDistance < 50 || isTrustedIP,
      distance_km: minDistance,
      anomaly_score: aiAnalysis.score,
      ai_reasoning: aiAnalysis.reasoning,
      success: decision.allowed
    });

    // 10. Handle block action
    if (decision.action === 'block') {
      const lockoutHours = aiAnalysis.lockout_hours || userSettings.lockout_duration_hours;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + lockoutHours);

      await fetch(`${supabaseUrl}/rest/v1/account_lockouts`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: loginContext.user_id,
          reason: aiAnalysis.reasoning,
          triggered_by: 'ai_anomaly_detection',
          anomaly_score: aiAnalysis.score,
          ip_address: loginContext.ip_address,
          expires_at: expiresAt.toISOString()
        })
      });

      return new Response(JSON.stringify({
        allowed: false,
        reason: 'suspicious_login_detected',
        anomaly_score: aiAnalysis.score,
        message: 'Login blocked due to unusual activity.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 10. Handle adding new trusted location
    if (decision.action === 'add_trust' && trustedLocations.length < userSettings.max_trusted_locations) {
      await upsertTrustedLocation(supabaseUrl, supabaseKey, {
        user_id: loginContext.user_id,
        ip_address: loginContext.ip_address,
        location: currentLocation
      });
    }

    const processingTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      allowed: true,
      reason: decision.reason,
      anomaly_score: aiAnalysis.score,
      distance_km: Math.round(minDistance * 100) / 100,
      new_location_added: decision.action === 'add_trust',
      processing_time_ms: processingTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Security check error:', error);

    // Fail open for availability
    return new Response(JSON.stringify({
      allowed: true,
      reason: 'system_error_fallback',
      message: 'Security check temporarily unavailable, login allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

async function analyzeWithAI(
  apiKey: string,
  context: LoginContext,
  currentLocation: LocationData,
  trustedLocations: TrustedLocation[],
  minDistance: number,
  recentAttempts: any[]  // ADD THIS
): Promise<{ score: number; reasoning: string; lockout_hours: number }> {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentHour = new Date().getHours();
  const currentDay = dayNames[new Date().getDay()];

  const trustedLocationsText = trustedLocations.length > 0
    ? trustedLocations.map((l, i) =>
        `${i + 1}. ${l.city}, ${l.country} (${l.login_count} logins, ${l.ip_address})`
      ).join('\n')
    : 'No trusted locations - first login';

  // Check for VPN usage pattern before calling AI
  const uniqueCountries = new Set(recentAttempts.map(a => a.country).filter(Boolean));
  const hasMultipleCountries = uniqueCountries.size >= 2;
  const lastAttempt = recentAttempts[0];
  const timeSinceLastAttempt = lastAttempt ? (Date.now() - new Date(lastAttempt.created_at).getTime()) / (1000 * 60 * 60) : 24; // hours
  const isRapidSwitch = hasMultipleCountries && timeSinceLastAttempt < 2;
  
  if (isRapidSwitch) {
    // VPN detected - return high score immediately without AI
    return {
      score: 0.9,
      reasoning: `VPN detected: ${uniqueCountries.size} countries in ${Math.round(timeSinceLastAttempt * 60)} minutes. Rapid location switching indicates VPN or proxy usage.`,
      lockout_hours: 24
    };
  }

  const recentAttemptsText = recentAttempts.length > 0 
    ? recentAttempts.map((a, i) => `- ${i + 1}. ${a.created_at?.substring(11, 16)} from ${a.city || 'Unknown'}, ${a.country || 'Unknown'} (IP: ${a.ip_address?.substring(0, 10)}...)`).join("\n")
    : "None";

  const userPrompt = `Analyze this login attempt for security threats. Score 0.0 (normal) to 1.0 (critical threat). BE AGGRESSIVE - assume VPN usage is malicious unless proven otherwise.

CURRENT LOGIN:
- IP: ${context.ip_address}
- Location: ${currentLocation.city || 'Unknown'}, ${currentLocation.country || 'Unknown'}
- ISP: ${currentLocation.org || 'Unknown'}
- Time: ${currentHour}:00 on ${currentDay}

TRUSTED LOCATIONS:
${trustedLocationsText}

DISTANCE ANALYSIS:
- Distance to nearest trusted: ${minDistance === Infinity ? 'N/A' : `${Math.round(minDistance)} km`}
- Exact IP match: ${trustedLocations.some(l => l.ip_address === context.ip_address) ? 'Yes' : 'No'}

RECENT LOGINS (last 24 hours):
${recentAttemptsText}

SCORING RULES - BE STRICT:
- Score 0.0-0.2: Same IP/city as trusted location, normal pattern
- Score 0.2-0.4: Nearby city (<100km), same country, reasonable time gap
- Score 0.4-0.6: Different city in same country, or 6+ hours from last login
- Score 0.6-0.8: DIFFERENT COUNTRY from recent logins, possible VPN usage
- Score 0.8-1.0: RAPID COUNTRY SWITCH - Multiple different countries in last 24h = VPN/abuse

CRITICAL: If recent logins show 2+ different countries in last 24h, score 0.75+ (VPN detected)
CRITICAL: If last login was different country less than 1 hour ago, score 0.85+ (rapid switch)

LOCKOUT DURATION:
- 0.0-0.3: 0 hours
- 0.3-0.5: 1-2 hours  
- 0.5-0.7: 4-8 hours
- 0.7-0.85: 12-24 hours
- 0.85-1.0: 24-72 hours

Respond ONLY with JSON: { "score": 0.XX, "reasoning": "specific reason", "lockout_hours": X }`;

  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You are a security analyst. Respond with JSON only.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_completion_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.max(0, Math.min(1, parsed.score || 0.5));
        let lockoutHours = parsed.lockout_hours || 0;
        
        // Validate lockout hours based on score
        if (score < 0.3) lockoutHours = 0;
        else if (score < 0.5) lockoutHours = Math.max(1, Math.min(2, lockoutHours));
        else if (score < 0.7) lockoutHours = Math.max(4, Math.min(8, lockoutHours));
        else if (score < 0.85) lockoutHours = Math.max(12, Math.min(24, lockoutHours));
        else lockoutHours = Math.max(24, Math.min(72, lockoutHours));
        
        return {
          score,
          reasoning: parsed.reasoning || 'AI analysis completed',
          lockout_hours: lockoutHours
        };
      } catch {
        console.error('Failed to parse AI response:', content);
      }
    }

    return { score: 0.5, reasoning: 'AI response parsing failed', lockout_hours: 0 };
  } catch (error) {
    console.error('AI analysis error:', error);
    return fallbackAnalysis(trustedLocations, minDistance, recentAttempts);
  }
}

function fallbackAnalysis(trustedLocations: TrustedLocation[], minDistance: number, recentAttempts: any[]): { score: number; reasoning: string; lockout_hours: number } {
  // Check for VPN in fallback too
  const uniqueCountries = new Set(recentAttempts.map(a => a.country).filter(Boolean));
  if (uniqueCountries.size >= 2) {
    return { score: 0.9, reasoning: 'VPN usage detected: multiple countries in recent attempts', lockout_hours: 24 };
  }
  
  if (trustedLocations.length === 0) {
    return { score: 0.15, reasoning: 'First login - learning trust', lockout_hours: 0 };
  }
  if (minDistance < 10) return { score: 0.1, reasoning: 'Very close to trusted location', lockout_hours: 0 };
  if (minDistance < 50) return { score: 0.2, reasoning: 'Within same city', lockout_hours: 0 };
  if (minDistance < 500) return { score: 0.4, reasoning: 'Different city but same region', lockout_hours: 0 };
  if (minDistance < 2000) return { score: 0.65, reasoning: 'Different region within country', lockout_hours: 4 };
  return { score: 0.85, reasoning: 'Different country detected', lockout_hours: 12 };
}

function makeDecision(
  aiAnalysis: { score: number; reasoning: string; lockout_hours: number },
  settings: SecuritySettings,
  distance: number,
  isTrustedIP: boolean,
  recentAttempts: any[]
): { allowed: boolean; action: string; reason: string } {
  // Lower threshold for blocking (0.6 instead of 0.75)
  const threshold = 0.6;
  
  // Check for rapid country switching in recent attempts
  const recentCountries = new Set(recentAttempts.map(a => a.country).filter(Boolean));
  const hasRapidSwitching = recentCountries.size >= 2 && recentAttempts.length >= 2;
  
  // Boost score if rapid switching detected
  let finalScore = aiAnalysis.score;
  if (hasRapidSwitching && finalScore < 0.7) {
    finalScore = 0.75; // Force higher score for VPN usage
  }

  if (finalScore >= threshold) {
    return { allowed: false, action: 'block', reason: 'suspicious_login_detected' };
  }

  if (finalScore >= 0.45 && !isTrustedIP) {
    return { allowed: true, action: 'add_trust', reason: 'new_location_detected' };
  }

  return { allowed: true, action: 'allow', reason: 'normal_login' };
}

async function logLoginAttempt(supabaseUrl: string, supabaseKey: string, attempt: any): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/login_attempts`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(attempt)
    });
  } catch (error) {
    console.error('Failed to log login attempt:', error);
  }
}

async function upsertTrustedLocation(
  supabaseUrl: string,
  supabaseKey: string,
  data: { user_id: string; ip_address: string; location: LocationData }
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/user_trusted_locations`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: data.user_id,
        ip_address: data.ip_address,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        city: data.location.city,
        region: data.location.region,
        country: data.location.country,
        country_code: data.location.country_code,
        is_primary: false,
        trust_score: 0.5,
        login_count: 1,
        first_login_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to add trusted location:', error);
  }
}
