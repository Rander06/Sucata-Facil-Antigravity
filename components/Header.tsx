import React from 'react';
import { Package, RefreshCw, Bell, Menu } from 'lucide-react';

interface HeaderProps {
    isSyncing: boolean;
    isAdmin: boolean;
    activeNotificationCount: number;
    setIsAuthModalOpen: (isOpen: boolean) => void;
    setIsMobileMenuOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({
    isSyncing,
    isAdmin,
    activeNotificationCount,
    setIsAuthModalOpen,
    setIsMobileMenuOpen
}) => {
    return (
        <header className="md:hidden no-print bg-brand-dark p-4 flex items-center justify-between z-50 shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-success rounded-lg flex items-center justify-center shadow-lg">
                    <Package className="text-white" size={20} />
                </div>
                <span className="font-black text-white uppercase tracking-tighter">SucataFácil</span>
                {isSyncing && <RefreshCw size={14} className="text-brand-success animate-spin ml-2" />}
            </div>
            <div className="flex items-center gap-3">
                {activeNotificationCount > 0 && (
                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="flex items-center justify-center w-8 h-8 bg-brand-error text-white rounded-lg animate-pulse shadow-lg shadow-brand-error/20 relative"
                    >
                        <Bell size={16} />
                        <span className="absolute -top-1 -right-1 bg-white text-brand-error text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-brand-error">
                            {activeNotificationCount}
                        </span>
                    </button>
                )}
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors">
                    <Menu size={28} />
                </button>
            </div>
        </header>
    );
};

export default Header;
