import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CustomBackgroundContextType {
  backgroundUri: string | null;
  setBackgroundUri: (uri: string | null) => Promise<void>;
  clearBackground: () => Promise<void>;
}

const CustomBackgroundContext = createContext<CustomBackgroundContextType | undefined>(undefined);

const BACKGROUND_STORAGE_KEY = '@custom_background_v1';

export const CustomBackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backgroundUri, setBackgroundUriState] = useState<string | null>(null);

  useEffect(() => {
    const loadBackground = async () => {
      try {
        const stored = await AsyncStorage.getItem(BACKGROUND_STORAGE_KEY);
        if (stored) {
          setBackgroundUriState(stored);
        }
      } catch (error) {
        console.error('Failed to load custom background:', error);
      }
    };
    loadBackground();
  }, []);

  const setBackgroundUri = useCallback(async (uri: string | null) => {
    try {
      if (uri) {
        await AsyncStorage.setItem(BACKGROUND_STORAGE_KEY, uri);
      } else {
        await AsyncStorage.removeItem(BACKGROUND_STORAGE_KEY);
      }
      setBackgroundUriState(uri);
    } catch (error) {
      console.error('Failed to save custom background:', error);
    }
  }, []);

  const clearBackground = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(BACKGROUND_STORAGE_KEY);
      setBackgroundUriState(null);
    } catch (error) {
      console.error('Failed to clear custom background:', error);
    }
  }, []);

  return (
    <CustomBackgroundContext.Provider value={{ backgroundUri, setBackgroundUri, clearBackground }}>
      {children}
    </CustomBackgroundContext.Provider>
  );
};

export const useCustomBackground = () => {
  const context = useContext(CustomBackgroundContext);
  if (context === undefined) {
    throw new Error('useCustomBackground must be used within a CustomBackgroundProvider');
  }
  return context;
};
