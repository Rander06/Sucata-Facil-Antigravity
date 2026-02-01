import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { PermissionModule, UserRole } from '../types';
import Inventory from './Inventory';
import Partners from './Partners';
import Users from './Users';
import Finance from './Finance';
import Banks from './Banks';
import {
  Package,
  Users as UsersIcon,
  Settings,
  CreditCard,
  ClipboardList,
  Layers,
  Tag,
  X,
  ChevronRight,
  Landmark
} from 'lucide-react';

const RegistrationHub: React.FC = () => {
  const { currentUser } = useAppContext();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const tabs = [
    {
      id: 'inventory',
      label: 'Estoque',
      description: 'Gestão de materiais e saldos',
      icon: Package,
      permission: PermissionModule.STOCK_VIEW,
      component: <Inventory />,
      color: 'green'
    },
    {
      id: 'partners',
      label: 'Parceiros',
      description: 'Clientes e fornecedores',
      icon: UsersIcon,
      permission: PermissionModule.PARTNERS_VIEW,
      component: <Partners />,
      color: 'blue'
    },
    {
      id: 'users',
      label: 'Equipe',
      description: 'Usuários e permissões de acesso',
      icon: Settings,
      permission: PermissionModule.TEAM_VIEW,
      component: <Users />,
      color: 'yellow'
    },
    {
      id: 'banks',
      label: 'Instituições Bancárias',
      description: 'Gestão de contas e bancos',
      icon: Landmark,
      permission: PermissionModule.FINANCE_VIEW,
      component: <Banks />,
      color: 'green'
    },
    {
      id: 'categories',
      label: 'Categorias Financeiras',
      description: 'Plano de contas e fluxos',
      icon: Tag,
      permission: PermissionModule.FINANCE_VIEW,
      component: <Finance mode="categories_only" />,
      color: 'red'
    },
    {
      id: 'terms',
      label: 'Prazos Comerciais',
      description: 'Condições de pagamento',
      icon: CreditCard,
      permission: PermissionModule.FINANCE_VIEW,
      component: <Finance mode="terms_only" />,
      color: 'indigo'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'border-t-brand-success shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)] hover:bg-gradient-to-b from-brand-success/10 to-transparent';
      case 'blue': return 'border-t-blue-500 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)] hover:bg-gradient-to-b from-blue-500/10 to-transparent';
      case 'yellow': return 'border-t-brand-warning shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)] hover:bg-gradient-to-b from-brand-warning/10 to-transparent';
      case 'red': return 'border-t-brand-error shadow-[0_0_15px_-5px_rgba(244,63,81,0.2)] hover:bg-gradient-to-b from-brand-error/10 to-transparent';
      case 'indigo': return 'border-t-indigo-500 shadow-[0_0_15px_-5px_rgba(99,102,241,0.2)] hover:bg-gradient-to-b from-indigo-500/10 to-transparent';
      default: return 'border-t-slate-800';
    }
  };

  const allowedTabs = tabs.filter(tab =>
    currentUser?.role === UserRole.SUPER_ADMIN ||
    currentUser?.role === UserRole.COMPANY_ADMIN ||
    currentUser?.permissions.includes(tab.permission as PermissionModule)
  );

  if (allowedTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Layers size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest text-center px-4">Acesso Restrito aos Cadastros</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <header className="px-1">
        <h1 className="text-2xl md:text-4xl font-black flex items-center gap-3 text-white uppercase tracking-tight">
          <ClipboardList className="text-brand-success" /> Cadastro Geral
        </h1>
        <p className="text-slate-400 text-[10px] md:text-sm mt-1 font-medium uppercase tracking-widest">Configuração estrutural da unidade.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-1">
        {allowedTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveModal(tab.id)}
            className={`enterprise-card p-6 md:p-8 flex items-center gap-4 md:gap-6 transition-all group text-left bg-slate-900/40 border-t-4 ${getColorClasses(tab.color || 'green')}`}
          >
            <div className={`w-12 md:w-16 h-12 md:h-16 rounded-2xl bg-slate-800 flex items-center justify-center transition-all border border-slate-700 ${tab.color === 'green' ? 'text-brand-success group-hover:bg-brand-success/10' :
              tab.color === 'blue' ? 'text-blue-400 group-hover:bg-blue-500/10' :
                tab.color === 'yellow' ? 'text-brand-warning group-hover:bg-brand-warning/10' :
                  tab.color === 'red' ? 'text-brand-error group-hover:bg-brand-error/10' :
                    'text-indigo-400 group-hover:bg-indigo-500/10'
              }`}>
              <tab.icon size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-black uppercase text-xs md:text-base tracking-widest group-hover:translate-x-1 transition-transform">{tab.label}</h3>
              <p className="text-slate-500 text-[9px] md:text-xs mt-1 truncate font-medium">{tab.description}</p>
            </div>
            <ChevronRight className="text-slate-700 group-hover:text-white transition-all group-hover:translate-x-1" size={20} />
          </button>
        ))}
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in duration-200">
          <header className="bg-brand-card border-b border-slate-800 p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-success/10 flex items-center justify-center text-brand-success border border-brand-success/20">
                {React.createElement(allowedTabs.find(t => t.id === activeModal)?.icon || Layers, { size: 18 })}
              </div>
              <h2 className="text-xs md:text-lg font-black text-white uppercase tracking-tighter">
                {allowedTabs.find(t => t.id === activeModal)?.label}
              </h2>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all flex items-center gap-2 px-3 md:px-4"
            >
              <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Fechar</span>
              <X size={18} />
            </button>
          </header>
          <main className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              {allowedTabs.find(t => t.id === activeModal)?.component}
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default RegistrationHub;