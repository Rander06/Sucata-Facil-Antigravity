
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<AuthorizationRequest[]>([]);
  const [posBuyCart, setPosBuyCart] = useState<CartItem[]>([]);
  const [posSellCart, setPosSellCart] = useState<CartItem[]>([]);
  const [posBuyPartnerId, setPosBuyPartnerId] = useState('');
  const [posSellPartnerId, setPosSellPartnerId] = useState('');
  const [posType, setPosType] = useState<'buy' | 'sell' | ''>('');
  const [posEditingRecordId, setPosEditingRecordId] = useState<string | null>(null);

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

  // Polling acelerado para 2 segundos (Enterprise v3.1 Performance Upgrade)
  useEffect(() => {
    if (currentUser) {
      const interval = setInterval(() => {
        refreshRequests();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser, refreshRequests]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('auth_user', JSON.stringify(currentUser));
      db.syncFromCloud();

      // Initialize POS type if not set
      if (!posType) {
        const isSuperUser = currentUser.role === UserRole.SUPER_ADMIN || currentUser.profile === OperationalProfile.MASTER;
        if (isSuperUser) setPosType('sell');
        else if (currentUser.permissions.includes(PermissionModule.PURCHASES_VIEW)) setPosType('buy');
        else if (currentUser.permissions.includes(PermissionModule.SALES_VIEW)) setPosType('sell');
        else setPosType('buy');
      }
    } else {
      localStorage.removeItem('auth_user');
    }
    refreshData();
    refreshRequests();
  }, [currentUser, refreshData, refreshRequests]);

  const logout = () => {
    setCurrentUser(null);
    setCurrentCompany(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, currentCompany, refreshData, isLoading, logout, isSyncing, isCloudEnabled, performManualSync, pendingRequests, refreshRequests,
      posBuyCart, setPosBuyCart, posSellCart, setPosSellCart, posBuyPartnerId, setPosBuyPartnerId, posSellPartnerId, setPosSellPartnerId, posType, setPosType, posEditingRecordId, setPosEditingRecordId
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
