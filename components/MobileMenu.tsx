import React from 'react';
import { Package, X, LogOut, ShieldAlert } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { PermissionModule } from '../types';

interface MenuItem {
    id: string;
    label: string;
    icon: any;
    category: string;
    permission: PermissionModule | string;
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    filteredMenu: MenuItem[];
    activePage: string;
    setActivePage: (page: string) => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, filteredMenu, activePage, setActivePage }) => {
    const { logout, currentUser } = useAppContext();

    if (!isOpen) return null;

    const handlePageChange = (id: string) => {
        setActivePage(id);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] md:hidden animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <aside className="absolute top-0 left-0 w-full max-w-[320px] h-full bg-brand-card flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 border-r border-slate-800">
                <div className="p-6 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-success rounded-lg flex items-center justify-center shadow-lg">
                            <Package className="text-white" size={20} />
                        </div>
                        <span className="font-black text-lg tracking-tight uppercase">SucataFácil</span>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <X size={28} />
                    </button>
                </div>

                <nav className="flex-1 mt-6 px-3 overflow-y-auto custom-scrollbar">
                    {['MASTER', 'OPERACIONAL'].map(category => {
                        const items = filteredMenu.filter(i => i.category === category);
                        if (items.length === 0) return null;
                        return (
                            <div key={category} className="mb-6">
                                <p className="px-4 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    {category === 'MASTER' && <ShieldAlert size={10} className="text-brand-success" />}
                                    {category}
                                </p>
                                {items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handlePageChange(item.id)}
                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all mb-1 ${activePage === item.id
                                            ? 'bg-brand-success text-white shadow-lg shadow-brand-success/10'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <item.icon size={20} className={activePage === item.id ? 'text-white' : 'text-slate-400'} />
                                        <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="mx-4 mb-4 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-success text-white flex items-center justify-center text-xl font-black shadow-lg">
                        {currentUser?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-white uppercase tracking-tight truncate">{currentUser?.name}</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{currentUser?.profile}</span>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 mt-auto bg-slate-950/30">
                    <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-xl text-brand-error bg-brand-error/5 hover:bg-brand-error/10 transition-colors">
                        <LogOut size={20} />
                        <span className="font-black text-sm uppercase tracking-widest">Sair do Sistema</span>
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default MobileMenu;
