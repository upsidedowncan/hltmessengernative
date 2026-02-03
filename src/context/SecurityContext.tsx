import React, { createContext, useState, useContext, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface TrustedLocation {
  id: string;
  ip_address: string;
  city: string;
  region: string | null;
  country: string;
  country_code: string | null;
  trust_score: number;
  login_count: number;
  first_login_at: string;
  last_login_at: string;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  city: string | null;
  region: string | null;
  country: string | null;
  distance_km: number | null;
  anomaly_score: number | null;
  ai_reasoning: string | null;
  success: boolean;
  created_at: string;
}

export interface SecuritySettings {
  location_tracking_enabled: boolean;
  max_trusted_locations: number;
  lockout_duration_hours: number;
  anomaly_threshold: number;
  require_2fa_on_new_device: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

interface SecurityContextType {
  isLocked: boolean;
  lockoutExpiresAt: string | null;
  trustedLocations: TrustedLocation[];
  recentAttempts: LoginAttempt[];
  securitySettings: SecuritySettings;
  loading: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  verifyLogin: () => Promise<{ allowed: boolean; reason: string }>;
  getTrustedLocations: () => Promise<void>;
  removeTrustedLocation: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<SecuritySettings>) => Promise<void>;
  checkLockoutStatus: () => Promise<void>;
  getRecentAttempts: (limit?: number) => Promise<void>;
  recordTrustedLocation: () => Promise<void>;
  setBlocked: (blocked: boolean, reason: string | null) => void;
}

const defaultSettings: SecuritySettings = {
  location_tracking_enabled: true,
  max_trusted_locations: 5,
  lockout_duration_hours: 24,
  anomaly_threshold: 0.6,
  require_2fa_on_new_device: false,
  email_notifications: false,
  push_notifications: false
};

const SecurityContext = createContext<SecurityContextType | null>(null);

export const SecurityProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutExpiresAt, setLockoutExpiresAt] = useState<string | null>(null);
  const [trustedLocations, setTrustedLocations] = useState<TrustedLocation[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<LoginAttempt[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const getUserId = useCallback(async () => {
    try {
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.data?.session?.user) {
        console.log('[SecurityContext] getUserId returning:', sessionResult.data.session.user.id);
        return sessionResult.data.session.user.id;
      }
      console.log('[SecurityContext] getUserId: no session or user');
    } catch (e) {
      console.log('[SecurityContext] getUserId exception:', e);
    }
    return null;
  }, []);

  const checkLockoutStatus = useCallback(async () => {
    const userId = await getUserId();
    console.log('[SecurityContext] checkLockoutStatus userId:', userId);
    if (!userId) {
      setIsLocked(false);
      setLockoutExpiresAt(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('account_lockouts')
        .select('expires_at')
        .eq('user_id', userId)
        .is('released_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return;

      if (data) {
        setIsLocked(true);
        setLockoutExpiresAt(data.expires_at);
      } else {
        setIsLocked(false);
        setLockoutExpiresAt(null);
      }
    } catch {
      // Ignore errors
    }
  }, [getUserId]);

  const getTrustedLocations = useCallback(async () => {
    const userId = await getUserId();
    console.log('[SecurityContext] getTrustedLocations called, userId:', userId);
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('user_trusted_locations')
        .select('*')
        .eq('user_id', userId)
        .order('login_count', { ascending: false });

      console.log('[SecurityContext] getTrustedLocations data:', data?.length, 'items, error:', error);
      if (!error && data) {
        setTrustedLocations(data);
        return data;
      }
    } catch (e) {
      console.log('[SecurityContext] getTrustedLocations exception:', e);
    }
    return [];
  }, [getUserId]);

  const getRecentAttempts = useCallback(async (limit: number = 10) => {
    const userId = await getUserId();
    console.log('[SecurityContext] getRecentAttempts userId:', userId);
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setRecentAttempts(data);
      }
    } catch {
      // Ignore errors
    }
  }, [getUserId]);

  const removeTrustedLocation = useCallback(async (id: string) => {
    try {
      await supabase
        .from('user_trusted_locations')
        .delete()
        .eq('id', id);
      await getTrustedLocations();
    } catch {
      // Ignore errors
    }
  }, [getTrustedLocations]);

  const updateSettings = useCallback(async (settings: Partial<SecuritySettings>) => {
    const userId = await getUserId();
    if (!userId) return;

    try {
      await supabase
        .from('user_security_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      setSecuritySettings(prev => ({ ...prev, ...settings }));
    } catch {
      // Ignore errors
    }
  }, [getUserId]);

  const recordTrustedLocation = useCallback(async () => {
    const userId = await getUserId();
    console.log('[SecurityContext] recordTrustedLocation called, userId:', userId);
    if (!userId) return;

    try {
      let ipAddress = '127.0.0.1';
      let ipData: any = {};

      try {
        console.log('[SecurityContext] Fetching IP info...');
        const ipResponse = await fetch('https://get.geojs.io/v1/ip/geo.json', {
          headers: { 'Accept': 'application/json' }
        });
        console.log('[SecurityContext] IP response status:', ipResponse.status, ipResponse.ok);
        
        if (ipResponse.ok) {
          ipData = await ipResponse.json();
          ipAddress = ipData.ip || '127.0.0.1';
          console.log('[SecurityContext] Got IP:', ipAddress, ipData);
        } else {
          const text = await ipResponse.text();
          console.log('[SecurityContext] IP fetch failed, response:', text);
        }
      } catch (e: any) {
        console.log('[SecurityContext] IP fetch exception:', e?.message || e);
      }

      const { error } = await supabase
        .from('user_trusted_locations')
        .insert({
          user_id: userId,
          ip_address: ipAddress,
          latitude: parseFloat(ipData.latitude) || 0,
          longitude: parseFloat(ipData.longitude) || 0,
          city: ipData.city || 'Unknown',
          region: ipData.region || null,
          country: ipData.country || 'Unknown',
          country_code: ipData.country_code || null,
          trust_score: 1.0,
          login_count: 1,
          first_login_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      console.log('[SecurityContext] Insert result, error:', error);
      if (!error) await getTrustedLocations();
    } catch (e) {
      console.log('[SecurityContext] recordTrustedLocation exception:', e);
    }
  }, [getUserId, getTrustedLocations]);

  const verifyLogin = useCallback(async (): Promise<{ allowed: boolean; reason: string }> => {
    const userId = await getUserId();
    console.log('[SecurityContext] verifyLogin userId:', userId);
    if (!userId) {
      return { allowed: false, reason: 'no_session' };
    }

    await checkLockoutStatus();
    if (isLocked && lockoutExpiresAt) {
      return { allowed: false, reason: 'account_locked' };
    }

    try {
      let ipAddress = '127.0.0.1';
      try {
        const ipResponse = await fetch('https://get.geojs.io/v1/ip/geo.json', {
          headers: { 'Accept': 'application/json' }
        });
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip || '127.0.0.1';
          console.log('[SecurityContext] verifyLogin IP:', ipAddress, ipData.city, ipData.country);
        } else {
          console.log('[SecurityContext] verifyLogin IP fetch failed:', ipResponse.status);
        }
      } catch (e) {
        console.log('[SecurityContext] verifyLogin IP exception:', e);
      }

      const sessionResult = await supabase.auth.getSession();
      if (!sessionResult.data?.session) {
        return { allowed: false, reason: 'no_session' };
      }

      console.log('[SecurityContext] Calling Edge Function...');
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/verify-login-location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionResult.data.session.access_token}`,
            'apikey': supabase.supabaseKey
          },
          body: JSON.stringify({
            user_id: userId,
            user_email: sessionResult.data.session.user.email || '',
            ip_address: ipAddress,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
          })
        }
      );

      console.log('[SecurityContext] Edge Function response status:', response.status);
      const text = await response.text();
      console.log('[SecurityContext] Edge Function response:', text);
      
      let result;
      try {
        result = JSON.parse(text);
        console.log('[SecurityContext] Edge Function result:', result);
      } catch (e) {
        console.log('[SecurityContext] Failed to parse JSON:', e);
        result = null;
      }
      
      if (result && result.allowed === false) {
        return { allowed: false, reason: result.reason || 'blocked' };
      }
      
      if (!response.ok) {
        console.log('[SecurityContext] Edge Function returned error status');
        return { allowed: false, reason: 'verification_error' };
      }
      
      return {
        allowed: result?.allowed ?? true,
        reason: result?.reason || 'success'
      };
    } catch (e) {
      console.log('[SecurityContext] verifyLogin exception:', e);
      return { allowed: false, reason: 'verification_error' };
    }
  }, [getUserId, checkLockoutStatus, isLocked, lockoutExpiresAt]);

  const loadUserSettings = useCallback(async () => {
    const userId = await getUserId();
    console.log('[SecurityContext] loadUserSettings userId:', userId);
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_security_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setSecuritySettings({
          location_tracking_enabled: data.location_tracking_enabled ?? true,
          max_trusted_locations: data.max_trusted_locations ?? 5,
          lockout_duration_hours: data.lockout_duration_hours ?? 24,
          anomaly_threshold: data.anomaly_threshold ?? 0.6,
          require_2fa_on_new_device: data.require_2fa_on_new_device ?? false,
          email_notifications: data.email_notifications ?? false,
          push_notifications: data.push_notifications ?? false
        });
      }
    } catch {
      // Ignore errors
    }
  }, [getUserId]);

  const loadSecurityData = useCallback(async () => {
    console.log('[SecurityContext] loadSecurityData called, initialized:', initialized);
    if (initialized) return;
    
    const userId = await getUserId();
    console.log('[SecurityContext] userId:', userId);
    if (!userId) {
      console.log('[SecurityContext] No userId, setting loading false');
      setLoading(false);
      return;
    }

    try {
      console.log('[SecurityContext] Loading security data...');
      await Promise.all([
        checkLockoutStatus(),
        getRecentAttempts(),
        loadUserSettings()
      ]);

      const locations = await getTrustedLocations();
      console.log('[SecurityContext] locations.length:', locations.length);
      
      if (locations.length === 0) {
        console.log('[SecurityContext] No locations, recording...');
        await recordTrustedLocation();
      } else {
        console.log('[SecurityContext] Already have', locations.length, 'locations, running security check...');
      }

      console.log('[SecurityContext] Running verifyLogin security check...');
      const result = await verifyLogin();
      console.log('[SecurityContext] Security check result:', result);
      
      if (!result.allowed) {
        console.log('[SecurityContext] User is BLOCKED, setting blocked state');
        setIsBlocked(true);
        setBlockReason(result.reason);
      }
      
      setInitialized(true);
      console.log('[SecurityContext] loadSecurityData complete');
    } catch (e) {
      console.log('[SecurityContext] loadSecurityData exception:', e);
    } finally {
      setLoading(false);
    }
  }, [getUserId, checkLockoutStatus, getTrustedLocations, getRecentAttempts, loadUserSettings, recordTrustedLocation, verifyLogin, initialized]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadSecurityData();
    }, 100);

    return () => clearTimeout(timer);
  }, [loadSecurityData]);

  const setBlocked = useCallback((blocked: boolean, reason: string | null) => {
    console.log('[SecurityContext] setBlocked:', blocked, reason);
    setIsBlocked(blocked);
    setBlockReason(reason);
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        lockoutExpiresAt,
        trustedLocations,
        recentAttempts,
        securitySettings,
        loading,
        isBlocked,
        blockReason,
        verifyLogin,
        getTrustedLocations,
        removeTrustedLocation,
        updateSettings,
        checkLockoutStatus,
        getRecentAttempts,
        recordTrustedLocation,
        setBlocked
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
