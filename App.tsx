
import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Partners from './pages/Partners';
import Reports from './pages/Reports';
import SaasAdmin from './pages/SaasAdmin';
import Support from './pages/Support';
import RegistrationHub from './pages/RegistrationHub';
import FinanceHub from './pages/FinanceHub';
import CloudConfig from './pages/CloudConfig';
import { UserRole } from './types';

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useAppContext();
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    if (currentUser?.role === UserRole.SUPER_ADMIN) {
      setActivePage('saas-dashboard');
    } else {
      setActivePage('dashboard');
    }
  }, [currentUser]);

  // Global "Auto-select on focus" system
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        ['text', 'number', 'email', 'password', 'tel', 'url', 'search'].includes((target as HTMLInputElement).type || '')
      ) {
        // Small timeout to allow browser's default focus behavior to complete
        setTimeout(() => {
          if (document.activeElement === target) {
            (target as HTMLInputElement | HTMLTextAreaElement).select();
          }
        }, 50);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  // Global "Enter as Tab" navigation system
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;

        // Only trigger for standard inputs and selects (ignore textareas and submit buttons)
        if (
          (target.tagName === 'INPUT' || target.tagName === 'SELECT') &&
          (target as HTMLInputElement).type !== 'submit' &&
          (target as HTMLInputElement).type !== 'button'
        ) {
          e.preventDefault();

          // Find all visible and enabled focusable elements in the document
          const focusable = Array.from(
            document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
          ).filter(el => {
            if (!(el instanceof HTMLElement) || el.hasAttribute('disabled')) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }) as HTMLElement[];

          const index = focusable.indexOf(target);
          if (index > -1 && index < focusable.length - 1) {
            focusable[index + 1].focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase to intercept early
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-success/20 border-t-brand-success rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Iniciando Sucata Fácil Enterprise...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Login />;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'registration': return <RegistrationHub />;
      case 'finance-hub': return <FinanceHub />;
      case 'pos': return <POS />;
      case 'inventory': return <Inventory />;
      case 'partners': return <Partners />;
      case 'reports': return <Reports />;
      case 'users': return <Users />;
      case 'support': return <Support />;
      case 'cloud-config': return <CloudConfig />;

      case 'saas-dashboard': return <SaasAdmin view="dashboard" />;
      case 'saas-companies': return <SaasAdmin view="companies" />;
      case 'saas-plans': return <SaasAdmin view="plans" />;

      default: return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-slate-500">
          <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Módulo em Desenvolvimento</h2>
          <p className="text-sm">A interface de {activePage} está sendo preparada para o próximo release.</p>
        </div>
      );
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={setActivePage}>
      {renderPage()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;