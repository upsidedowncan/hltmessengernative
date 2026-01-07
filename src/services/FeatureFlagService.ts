import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  is_enabled: boolean;
  value: string | null;
  config: any | null;
  user_id: string | null;
}

const STORAGE_KEY_FLAGS = '@feature_flags_v3';
const STORAGE_KEY_OVERRIDES = '@feature_flag_overrides_v3';

class FeatureFlagService {
  private flags: Record<string, { enabled: boolean; value: string | null; config: any | null }> = {};
  private overrides: Record<string, { enabled: boolean | null; value: string | null }> = {};
  private initialized = false;

  async init() {
    if (this.initialized) return;

    try {
      const storedFlags = await AsyncStorage.getItem(STORAGE_KEY_FLAGS);
      const storedOverrides = await AsyncStorage.getItem(STORAGE_KEY_OVERRIDES);

      if (storedFlags) {
        this.flags = JSON.parse(storedFlags);
      }
      if (storedOverrides) {
        this.overrides = JSON.parse(storedOverrides);
      }

      await this.sync();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize FeatureFlagService:', error);
    }
  }

  async sync() {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*');

      if (error) throw error;

      if (data) {
        const newFlags: Record<string, { enabled: boolean; value: string | null; config: any | null }> = {};
        data.forEach((flag: FeatureFlag) => {
          if (newFlags[flag.key] === undefined || flag.user_id !== null) {
             newFlags[flag.key] = { enabled: flag.is_enabled, value: flag.value, config: flag.config };
          }
        });

        this.flags = newFlags;
        await AsyncStorage.setItem(STORAGE_KEY_FLAGS, JSON.stringify(this.flags));
      }
    } catch (error) {
      console.error('Failed to sync feature flags:', error);
    }
  }

  isEnabled(key: string): boolean {
    if (this.overrides[key] && this.overrides[key].enabled !== null) {
      return this.overrides[key].enabled as boolean;
    }
    return this.flags[key]?.enabled || false;
  }

  getValue(key: string): string | null {
    if (this.overrides[key] && this.overrides[key].value !== null) {
      return this.overrides[key].value;
    }
    return this.flags[key]?.value || null;
  }

  getDebugInfo() {
    const allKeys = new Set([...Object.keys(this.flags), ...Object.keys(this.overrides)]);
    const info: { 
      key: string; 
      serverEnabled: boolean; 
      serverValue: string | null;
      config: any | null;
      overrideEnabled: boolean | null; 
      overrideValue: string | null;
      isEnabled: boolean;
      value: string | null;
    }[] = [];
    
    allKeys.forEach(key => {
        info.push({
            key,
            serverEnabled: this.flags[key]?.enabled || false,
            serverValue: this.flags[key]?.value || null,
            config: this.flags[key]?.config || null,
            overrideEnabled: this.overrides[key]?.enabled ?? null,
            overrideValue: this.overrides[key]?.value ?? null,
            isEnabled: this.isEnabled(key),
            value: this.getValue(key)
        });
    });
    return info;
  }

  async setOverride(key: string, enabled?: boolean | null, value: string | null = undefined as any) {
    if (enabled === null && value === null) {
      delete this.overrides[key];
    } else {
      const currentOverride = this.overrides[key] || { enabled: null, value: null };
      this.overrides[key] = { 
          enabled: enabled !== undefined ? enabled : currentOverride.enabled, 
          value: value !== undefined ? value : currentOverride.value
      };
    }
    await AsyncStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(this.overrides));
  }
}

export const featureFlagService = new FeatureFlagService();
