import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { createApiClient } from '../utils/apiClient';
import { connectSocket } from '../utils/socket';

interface AlertsContextType {
  unresolvedCount: number;
  refreshUnresolvedCount: () => Promise<void>;
}

const AlertsContext = createContext<AlertsContextType>({
  unresolvedCount: 0,
  refreshUnresolvedCount: async () => {},
});

export const useAlertsContext = () => useContext(AlertsContext);

interface AlertsProviderProps {
  children: ReactNode;
}

// System route prefixes that should NOT be treated as client codes
const EXCLUDED_PREFIXES = ['admin', 'config', 'areas', 'analysis', 'alerts'];

function extractClientCode(pathname: string): string | null {
  // pathname example: "/julcani/dashboard" → first segment = "julcani"
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (!first || EXCLUDED_PREFIXES.includes(first)) return null;
  return first;
}

export const AlertsProvider: React.FC<AlertsProviderProps> = ({ children }) => {
  const location = useLocation();
  const clientCode = extractClientCode(location.pathname);
  
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const clientCodeRef = useRef(clientCode);
  clientCodeRef.current = clientCode;

  const fetchUnresolvedCount = useCallback(async () => {
    const code = clientCodeRef.current;
    if (!code) {
      setUnresolvedCount(0);
      return;
    }

    try {
      const api = createApiClient(code);
      const response = await api.get('/alerts', { params: { page: 1, limit: 1, isResolved: false } });
      
      if (response?.data?.pagination) {
        setUnresolvedCount(response.data.pagination.total || response.data.pagination.totalItems || 0);
      }
    } catch (error) {
      console.error('Error fetching unresolved alerts count:', error);
    }
  }, []);

  useEffect(() => {
    // 1. Initial fetch when clientCode changes
    fetchUnresolvedCount();

    // 2. Setup socket listener for new alerts
    if (clientCode) {
      const socket = connectSocket(); // ensures socket is created
      
      const handleNewAlert = () => {
        fetchUnresolvedCount();
      };

      socket.on('new-alert', handleNewAlert);

      return () => {
        socket.off('new-alert', handleNewAlert);
      };
    }
  }, [clientCode, fetchUnresolvedCount]);

  const value = {
    unresolvedCount,
    refreshUnresolvedCount: fetchUnresolvedCount
  };

  return (
    <AlertsContext.Provider value={value}>
      {children}
    </AlertsContext.Provider>
  );
};
