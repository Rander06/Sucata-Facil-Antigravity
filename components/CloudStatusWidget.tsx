import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppContext } from '../store/AppContext';

interface CloudStatusWidgetProps {
  isCollapsed?: boolean;
}

const CloudStatusWidget: React.FC<CloudStatusWidgetProps> = ({ isCollapsed = false }) => {
  const { isSyncing, performManualSync, isCloudEnabled, isOnline } = useAppContext();

  return (
    <div className={`mt-2 mx-2 p-2 rounded-lg border border-slate-800 bg-slate-900/50 flex flex-col gap-2 no-print ${isCollapsed ? 'items-center px-0' : ''}`}>
      <div className={`flex items-center justify-between w-full ${isCollapsed ? 'flex-col gap-2' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${!isOnline ? 'bg-brand-error animate-pulse' : (isSyncing ? 'bg-brand-success animate-ping' : (isCloudEnabled ? 'bg-brand-success' : 'bg-slate-600'))}`}></div>
          {!isCollapsed && <span className={`text-[9px] font-black uppercase tracking-widest ${!isOnline ? 'text-brand-error' : (isCloudEnabled ? 'text-brand-success' : 'text-slate-500')}`}>{!isOnline ? 'Offline' : (isCloudEnabled ? 'Cloud Ativa' : 'Cloud Sync')}</span>}
        </div>
        <button
          onClick={() => performManualSync()}
          disabled={isSyncing || !isCloudEnabled || !isOnline}
          className={`p-1 rounded-md bg-slate-800 text-slate-400 hover:text-white transition-all ${isSyncing ? 'animate-spin cursor-not-allowed' : ''} ${(!isCloudEnabled || !isOnline) ? 'opacity-20 cursor-not-allowed' : ''}`}
          title="Sincronizar Agora"
        >
          <RefreshCw size={10} />
        </button>
      </div>
      {!isCollapsed && isSyncing && (
        <p className="text-[8px] font-bold text-brand-success uppercase tracking-widest animate-pulse">Sincronizando...</p>
      )}
    </div>
  );
};

export default CloudStatusWidget;
