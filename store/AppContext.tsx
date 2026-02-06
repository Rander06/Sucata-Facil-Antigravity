
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Company, UserRole, PermissionModule, AuthorizationRequest, CartItem, OperationalProfile } from '../types';
import { db } from '../services/dbService';
import { authorizationService } from '../services/authorizationService';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  currentCompany: Company | null;
  refreshData: () => void;
  isLoading: boolean;
  logout: () => void;
  isSyncing: boolean;
  isCloudEnabled: boolean;
  isOnline: boolean;
  performManualSync: () => Promise<void>;
  pendingRequests: AuthorizationRequest[];
  refreshRequests: () => void;
  posBuyCart: CartItem[];
  setPosBuyCart: (cart: CartItem[]) => void;
  posSellCart: CartItem[];
  setPosSellCart: (cart: CartItem[]) => void;
  posBuyPartnerId: string;
  setPosBuyPartnerId: (id: string) => void;
  posSellPartnerId: string;
  setPosSellPartnerId: (id: string) => void;
  posType: 'buy' | 'sell' | '';
  setPosType: (type: 'buy' | 'sell' | '') => void;
  posEditingRecordId: string | null;
  setPosEditingRecordId: (id: string | null) => void;
  dataVersion: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingRequests, setPendingRequests] = useState<AuthorizationRequest[]>([]);
  const [posBuyCart, setPosBuyCart] = useState<CartItem[]>([]);
  const [posSellCart, setPosSellCart] = useState<CartItem[]>([]);
  const [posBuyPartnerId, setPosBuyPartnerId] = useState('');
  const [posSellPartnerId, setPosSellPartnerId] = useState('');
  const [posType, setPosType] = useState<'buy' | 'sell' | ''>('');
  const [posEditingRecordId, setPosEditingRecordId] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = useCallback(() => {
    const user = currentUser;
    if (user?.companyId || user?.company_id) {
      const cid = user.companyId || user.company_id;
      const companies = db.query<Company>('companies');
      const company = companies.find(c => c.id === cid);
      setCurrentCompany(company || null);
    } else {
      setCurrentCompany(null);
    }
    setIsCloudEnabled(!!db.getCloudClient());
    setDataVersion(prev => prev + 1);
  }, [currentUser]);

  const refreshRequests = useCallback(() => {
    if (!currentUser) return;
    const cid = currentUser.companyId || currentUser.company_id || null;
    const requests = authorizationService.getPendingAuthorizations(cid);
    setPendingRequests(requests);
  }, [currentUser]);

  const performManualSync = useCallback(async () => {
    const client = db.getCloudClient();
    if (client) {
      setIsSyncing(true);
      const success = await db.syncFromCloud();
      setIsSyncing(false);
      if (success) {
        refreshData();
        refreshRequests();
      }
    }
  }, [refreshData, refreshRequests]);

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      db.reInitializeCloud();
      const hasCloud = !!db.getCloudClient();
      setIsCloudEnabled(hasCloud);
      if (hasCloud) await db.syncFromCloud();
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        let user = JSON.parse(storedUser);
        const profiles = db.query<User>('users');
        const freshProfile = profiles.find(u => u.id === user.id || u.email === user.email);
        if (freshProfile) setCurrentUser(freshProfile);
        else setCurrentUser(user);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // Polling acelerado (Fallback) + Realtime Subscription initialization
  useEffect(() => {
    if (currentUser) {
      // Fallback Polling every 5s (Aggressive fallback for mobile networks)
      const interval = setInterval(() => {
        refreshRequests();
        const client = db.getCloudClient();
        if (client) {
          // Silent sync check
          db.syncFromCloud().then(success => {
            if (success) {
              refreshData();
              refreshRequests();
            }
          });
        }
      }, 60000); // Polling de redundância a cada 60s (Realtime cuida do tempo real)

      // Initialize Realtime Subscription
      const unsubscribe = db.subscribeToChanges(() => {
        refreshData();
        refreshRequests();
      });

      // Heartbeat: Update presence every 10 seconds
      const heartbeatInterval = setInterval(() => {
        if (currentUser) {
          const now = new Date().toISOString();
          db.update('users', currentUser.id, { updated_at: now });
        }
      }, 10000);

      return () => {
        clearInterval(interval);
        clearInterval(heartbeatInterval);
        unsubscribe();
      };
    }
  }, [currentUser, refreshRequests, refreshData]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('auth_user', JSON.stringify(currentUser));

      // Update Login Timestamp if not set recently (e.g., within last minute) to avoid spam on refresh
      const now = new Date().toISOString();
      const lastUpdate = currentUser.updated_at ? new Date(currentUser.updated_at).getTime() : 0;
      if (Date.now() - lastUpdate > 60000) {
        db.update('users', currentUser.id, { last_login: now, updated_at: now });
      }

      db.syncFromCloud();

      // Initialize POS type if not set
      if (!posType) {
        const isSuperUser = currentUser.role === UserRole.SUPER_ADMIN || currentUser.profile?.includes(OperationalProfile.MASTER);
        if (isSuperUser) setPosType('sell');
        else if (currentUser.permissions.includes(PermissionModule.PURCHASES_PDV)) setPosType('buy');
        else if (currentUser.permissions.includes(PermissionModule.SALES_PDV)) setPosType('sell');
        else setPosType('buy');
      }
    } else {
      localStorage.removeItem('auth_user');
    }
    refreshData();
    refreshRequests();
  }, [currentUser, refreshData, refreshRequests]);

  const logout = () => {
    if (currentUser) {
      const now = new Date().toISOString();
      db.update('users', currentUser.id, { last_logout: now, updated_at: now })
        .catch(err => console.error("Error updating logout timestamp:", err));
    }
    setCurrentUser(null);
    setCurrentCompany(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, currentCompany, refreshData, isLoading, logout, isSyncing, isCloudEnabled, isOnline, performManualSync, pendingRequests, refreshRequests,
      posBuyCart, setPosBuyCart, posSellCart, setPosSellCart, posBuyPartnerId, setPosBuyPartnerId, posSellPartnerId, setPosSellPartnerId, posType, setPosType, posEditingRecordId, setPosEditingRecordId,
      dataVersion
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    console.error('[CONTEXT] useAppContext was called outside an AppProvider. This usually happens if a component is rendered via a portal or outside the root <App /> tree.');
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
