import React, { createContext, useContext, useEffect, useState } from 'react';
import { featureFlagService } from '../services/FeatureFlagService';

interface FeatureFlagContextType {
  isEnabled: (key: string) => boolean;
  getValue: (key: string) => string | null;
  reloadFlags: () => Promise<void>;
  setOverride: (key: string, enabled?: boolean | null, value?: string | null) => Promise<void>;
  debugInfo: any[];
  isLoading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);

  const refreshState = () => {
    setDebugInfo(featureFlagService.getDebugInfo());
  };

  const reloadFlags = async () => {
    setIsLoading(true);
    await featureFlagService.sync();
    refreshState();
    setIsLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      await featureFlagService.init();
      refreshState();
      setIsLoading(false);
    };
    init();
  }, []);

  const setOverride = async (key: string, enabled?: boolean | null, value: string | null = null) => {
    await featureFlagService.setOverride(key, enabled, value);
    refreshState();
  };

  const isEnabled = (key: string) => {
    return featureFlagService.isEnabled(key);
  };

  const getValue = (key: string) => {
    return featureFlagService.getValue(key);
  };

  return (
    <FeatureFlagContext.Provider value={{ isEnabled, getValue, reloadFlags, setOverride, debugInfo, isLoading }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};
