import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppContext } from '../store/AppContext';

interface CloudStatusWidgetProps {
  isCollapsed?: boolean;
}

const CloudStatusWidget: React.FC<CloudStatusWidgetProps> = ({ isCollapsed = false }) => {
  const { isSyncing, performManualSync, isCloudEnabled } = useAppContext();

  return (
    <div className={`mt-4 mx-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col gap-2 no-print ${isCollapsed ? 'items-center px-0' : ''}`}>
       <div className={`flex items-center justify-between w-full ${isCollapsed ? 'flex-col gap-2' : ''}`}>
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-brand-success animate-ping' : (isCloudEnabled ? 'bg-brand-success' : 'bg-slate-600')}`}></div>
             {!isCollapsed && <span className={`text-[10px] font-black uppercase tracking-widest ${isCloudEnabled ? 'text-brand-success' : 'text-slate-500'}`}>Cloud {isCloudEnabled ? 'Ativa' : 'Sync'}</span>}
          </div>
          <button 
            onClick={() => performManualSync()} 
            disabled={isSyncing || !isCloudEnabled}
            className={`p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all ${isSyncing ? 'animate-spin cursor-not-allowed' : ''} ${!isCloudEnabled ? 'opacity-20 cursor-not-allowed' : ''}`}
            title="Sincronizar Agora"
          >
             <RefreshCw size={12} />
          </button>
       </div>
       {!isCollapsed && isSyncing && (
         <p className="text-[8px] font-bold text-brand-success uppercase tracking-widest animate-pulse">Sincronizando Banco de Dados...</p>
       )}
    </div>
  );
};

export default CloudStatusWidget;
