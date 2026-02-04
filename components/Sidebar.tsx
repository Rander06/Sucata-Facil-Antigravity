import React from 'react';
import { Package, ChevronLeft, Menu, LogOut, ShieldAlert, Bell } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import CloudStatusWidget from './CloudStatusWidget';
import { PermissionModule } from '../types';

interface MenuItem {
    id: string;
    label: string;
    icon: any;
    category: string;
    permission: PermissionModule | string;
}

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    filteredMenu: MenuItem[];
    activePage: string;
    setActivePage: (page: string) => void;
    isAdmin: boolean;
    activeNotificationCount: number;
    setIsAuthModalOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    filteredMenu,
    activePage,
    setActivePage,
    isAdmin,
    activeNotificationCount,
    setIsAuthModalOpen
}) => {
    const { logout, currentUser, isSyncing, performManualSync, isCloudEnabled, isOnline } = useAppContext();

    return (
        <aside className={`hidden md:flex no-print bg-brand-card border-r border-slate-800 transition-all duration-300 z-50 ${isSidebarOpen ? 'w-64' : 'w-20'} flex-col relative`}>
            <div className="p-6 flex items-center justify-between">
                <div className={`flex items-center gap-3 ${!isSidebarOpen && 'hidden'}`}>
                    <Package className="text-brand-success" size={24} />
                    <span className="font-black text-lg text-white uppercase tracking-tighter">SucataFácil</span>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 text-slate-500 hover:text-white transition-colors bg-slate-900/50 rounded-lg ${!isSidebarOpen && 'mx-auto'}`}
                    title={isSidebarOpen ? "Recolher Menu" : "Expandir Menu"}
                >
                    {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                </button>
            </div>

            <nav className="flex-1 mt-4 px-3 overflow-y-auto custom-scrollbar">
                {['MASTER', 'OPERACIONAL'].map(category => {
                    const items = filteredMenu.filter(i => i.category === category);
                    if (items.length === 0) return null;
                    return (
                        <div key={category} className="mb-6">
                            {!isSidebarOpen ? (
                                <div className="mx-4 mb-2 border-b border-slate-800/50"></div>
                            ) : (
                                <p className="px-4 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    {category === 'MASTER' && <ShieldAlert size={10} className="text-brand-success" />}
                                    {category}
                                </p>
                            )}
                            {items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActivePage(item.id)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all mb-1 ${activePage === item.id
                                        ? 'bg-brand-success text-white shadow-lg shadow-brand-success/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                        } ${!isSidebarOpen ? 'justify-center px-0' : ''}`}
                                    title={!isSidebarOpen ? item.label : undefined}
                                >
                                    <item.icon size={20} className={activePage === item.id ? 'text-white' : 'text-slate-400'} />
                                    {isSidebarOpen && <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.label}</span>}
                                </button>
                            ))}
                        </div>
                    );
                })}
            </nav>

            {/* INDICADOR DE LIBERAÇÕES PENDENTES */}
            {activeNotificationCount > 0 && (
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className={`mx-3 mb-2 p-3 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-left-4 hover:bg-brand-error/20 transition-all group ${!isSidebarOpen && 'justify-center'}`}
                >
                    <Bell className="text-brand-error animate-bounce group-hover:scale-110 transition-transform" size={16} />
                    {isSidebarOpen && (
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-brand-error uppercase tracking-widest">Ações de Segurança</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{activeNotificationCount} pendentes</span>
                        </div>
                    )}
                </button>
            )}

            {/* <CloudStatusWidget /> Removed - Integrated into footer */}

            <div className="mx-2 mt-2 p-2 bg-slate-900/50 border border-slate-800 rounded-lg flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md bg-brand-success/10 border border-brand-success/20 flex items-center justify-center text-brand-success font-black text-xs ${!isSidebarOpen && 'mx-auto'}`}>
                    {currentUser?.name?.charAt(0).toUpperCase()}
                </div>
                {isSidebarOpen && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-white uppercase truncate tracking-tight">{currentUser?.name}</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{currentUser?.profile}</span>
                    </div>
                )}
            </div>

            <div className={`p-4 border-t border-slate-800 mt-auto flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
                {/* Minimal Cloud Indicator (Click to Sync) */}
                <button
                    onClick={() => performManualSync()}
                    disabled={isSyncing || !isCloudEnabled || !isOnline}
                    className={`relative group flex items-center justify-center p-2 rounded-lg transition-all ${(!isCloudEnabled || !isOnline) ? 'opacity-50' : 'hover:bg-slate-800/50'}`}
                    title={!isOnline ? 'Offline' : (isSyncing ? 'Sincronizando...' : 'Cloud Ativa - Clique para Sincronizar')}
                >
                    <div className={`w-3.5 h-3.5 rounded-full ${!isOnline ? 'bg-brand-error animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' : (isSyncing ? 'bg-brand-success animate-ping' : (isCloudEnabled ? 'bg-brand-success shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-slate-600'))}`}></div>
                </button>

                {/* Minimal Logout Button */}
                <button
                    onClick={logout}
                    className="p-2 text-brand-error hover:text-red-400 hover:bg-brand-error/10 rounded-lg transition-all"
                    title="Sair do Sistema"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
