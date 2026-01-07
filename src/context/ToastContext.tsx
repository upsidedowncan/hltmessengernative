import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Toast, ToastData, ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (title: string, description: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<any>(null);

  const hideToast = useCallback(() => {
    setToast(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const showToast = useCallback((title: string, description: string, type: ToastType = 'info', duration = 4000) => {
    // If a toast is already showing, hide it first
    if (toast) {
      setToast(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    // Set new toast
    setToast({
      id: Date.now().toString(),
      title,
      description,
      type
    });

    // Auto-hide
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast data={toast} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
