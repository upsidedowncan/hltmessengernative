import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project URL and Anon Key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cjlgzsvxzmrovclmoser.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_rdjKLmivlNZzBDrAwNVMaw_nNRVTGGj';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
