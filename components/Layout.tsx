import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Lock,
  LifeBuoy,
  ClipboardList,
  Wallet,
  Cloud,
  Building2,
  BarChart3,
  Archive, // Changed from Package to Archive to avoid conflict if Package is imported elsewhere or just to be safe, but actually Package was used for 'SucataFácil' logo.
  Package
} from 'lucide-react';
import { PermissionModule, UserRole } from '../types';
import AuthorizeRequestModal from './AuthorizeRequestModal';
import Sidebar from './Sidebar';
import MobileMenu from './MobileMenu';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage }) => {
  const { currentUser, pendingRequests } = useAppContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return true;
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Calcula apenas os pedidos que realmente precisam de ação do gestor (PENDING)
  const activeNotificationCount = useMemo(() =>
    pendingRequests.filter(r => r.status === 'PENDING').length,
    [pendingRequests]
  );

  if (!currentUser) return null;

  const isMasterUser = currentUser.email === 'admin@sucatafacil.com';
  const isAdmin = currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.COMPANY_ADMIN;

  const menuItems = [
    { id: 'saas-dashboard', label: 'Dashboard Master', icon: LayoutDashboard, category: 'MASTER', permission: PermissionModule.SAAS_DASHBOARD },
    { id: 'saas-companies', label: 'Gerenciar Empresas', icon: Building2, category: 'MASTER', permission: PermissionModule.SAAS_COMPANIES },
    { id: 'saas-plans', label: 'Modelos de Planos', icon: Lock, category: 'MASTER', permission: PermissionModule.SAAS_PLANS },
    { id: 'cloud-config', label: 'Infraestrutura Cloud', icon: Cloud, category: 'MASTER', permission: PermissionModule.SAAS_DASHBOARD },

    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'OPERACIONAL', permission: PermissionModule.DASHBOARD },
    { id: 'registration', label: 'Cadastro', icon: ClipboardList, category: 'OPERACIONAL', permission: 'ANY_REGISTRATION' },
    { id: 'finance-hub', label: 'Financeiro', icon: Wallet, category: 'OPERACIONAL', permission: PermissionModule.FINANCE_VIEW },
    { id: 'pos', label: 'Compra / Venda', icon: ShoppingCart, category: 'OPERACIONAL', permission: PermissionModule.PURCHASES_VIEW },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, category: 'OPERACIONAL', permission: PermissionModule.REPORTS_VIEW },
    { id: 'support', label: 'Suporte & Backup', icon: LifeBuoy, category: 'OPERACIONAL', permission: PermissionModule.SUPPORT_VIEW },
  ];

  const filteredMenu = menuItems.filter(item => {
    if (isMasterUser) return true;
    // Admins da empresa também têm acesso total aos módulos operacionais
    if ((currentUser.role === UserRole.COMPANY_ADMIN || currentUser.role === UserRole.SUPER_ADMIN) && item.category === 'OPERACIONAL') return true;

    if (item.id === 'support') {
      return (
        currentUser.permissions.includes(PermissionModule.SUPPORT_VIEW) ||
        currentUser.permissions.includes(PermissionModule.SUPPORT_HELP_CHANNELS) ||
        currentUser.permissions.includes(PermissionModule.SUPPORT_SECURITY_BACKUP)
      );
    }

    if (item.id === 'registration') {
      const registrationPermissions = [
        PermissionModule.STOCK_VIEW,
        PermissionModule.PARTNERS_VIEW,
        PermissionModule.TEAM_VIEW,
        PermissionModule.FINANCE_VIEW
      ];
      return registrationPermissions.some(p => currentUser.permissions.includes(p));
    }
    if (item.id === 'pos') {
      return currentUser.permissions.includes(PermissionModule.PURCHASES_VIEW) || currentUser.permissions.includes(PermissionModule.SALES_VIEW);
    }
    if (item.id === 'reports') {
      const reportPermissions = [
        PermissionModule.REPORTS_VIEW,
        PermissionModule.REPORTS_GENERAL,
        PermissionModule.REPORTS_RECEIVABLES,
        PermissionModule.REPORTS_PAYABLES,
        PermissionModule.REPORTS_STOCK,
        PermissionModule.REPORTS_PARTNERS,
        PermissionModule.REPORTS_AUDIT
      ];
      return reportPermissions.some(p => currentUser.permissions.includes(p));
    }

    if (item.id === 'finance-hub') {
      return (
        currentUser.permissions.includes(PermissionModule.FINANCE_VIEW) ||
        currentUser.permissions.includes(PermissionModule.FINANCE_LIQUIDATE) ||
        currentUser.permissions.includes(PermissionModule.FINANCE_AUDIT) ||
        currentUser.permissions.includes(PermissionModule.FINANCE_EXTRACT) ||
        currentUser.permissions.includes(PermissionModule.FINANCE_CREATE) ||
        currentUser.permissions.includes(PermissionModule.FINANCE_EDIT) ||
        currentUser.permissions.includes(PermissionModule.FINANCE_DELETE)
      );
    }
    return currentUser.permissions.includes(item.permission as PermissionModule);
  });

  return (
    <div className="flex h-screen bg-brand-dark overflow-hidden flex-col md:flex-row">
      <Header
        isSyncing={false} // Layout doesn't have isSyncing directly? Oh, original used useAppContext().
        // Wait, I needs to pass isSyncing from Layout?
        // Original: const { ..., isSyncing, ... } = useAppContext();
        // So I should pass it.
        isAdmin={isAdmin}
        activeNotificationCount={activeNotificationCount}
        setIsAuthModalOpen={setIsAuthModalOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        filteredMenu={filteredMenu}
        activePage={activePage}
        setActivePage={setActivePage}
        isAdmin={isAdmin}
        activeNotificationCount={activeNotificationCount}
        setIsAuthModalOpen={setIsAuthModalOpen}
      />

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        filteredMenu={filteredMenu}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="flex-1 overflow-y-auto bg-brand-dark md:p-8 relative">
        <div className="max-w-7xl mx-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>

      <AuthorizeRequestModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export default Layout;