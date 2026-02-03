import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: AuthError; data?: Session }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error?: AuthError }>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  signInWithEmail: async () => ({ error: new AuthError('Not implemented') }),
  signUpWithEmail: async () => ({ error: new AuthError('Not implemented') }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const checkSecurityAndLogin = async (
    email: string,
    password: string
  ): Promise<{ error?: AuthError; data?: Session }> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Authentication error:', authError);
        return { error: authError };
      }

      if (!authData.session) {
        return { error: new AuthError('No session created') };
      }

      setSession(authData.session);
      setUser(authData.session.user);
      await fetchProfile(authData.session.user.id);

      return { data: authData.session };
    } catch (error) {
      console.error('Unexpected login error:', error);
      return { error: error as AuthError };
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error?: AuthError; data?: Session }> => {
    return checkSecurityAndLogin(email, password);
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error?: AuthError }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        return { error };
      }

      if (data.user) {
        const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: `${username}_${Date.now().toString(36)}`,
            full_name: fullName,
            avatar_url: null
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      return { error: undefined };
    } catch (error) {
      console.error('Unexpected signup error:', error);
      return { error: error as AuthError };
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
        signInWithEmail,
        signUpWithEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
