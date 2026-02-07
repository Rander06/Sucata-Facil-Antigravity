import React, { useMemo } from 'react';
import { X, Lock, Clock, User as UserIcon, AlertTriangle, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { authorizationService } from '../services/authorizationService';

interface RequestAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  actionKey: string;
  actionLabel: string;
}

const RequestAuthorizationModal: React.FC<RequestAuthorizationModalProps> = ({ isOpen, onClose, onSuccess, actionKey, actionLabel }) => {
  const { currentUser, pendingRequests, refreshRequests } = useAppContext();

  const existingRequest = useMemo(() =>
    pendingRequests.find(req => req.action_key === actionKey && req.action_label === actionLabel && req.status === 'PENDING'),
    [pendingRequests, actionKey, actionLabel]
  );

  const isDuplicate = !!existingRequest;

  const getHumanExplanation = (label: string) => {
    if (!label) return 'DETALHES DA OPERAÇÃO NÃO INFORMADOS';

    // Extração baseada no formato pipe-delimited unificado
    const parts = label.split(' | ');
    const data: Record<string, string> = {};
    parts.forEach(p => {
      const [key, ...val] = p.split(': ');
      if (key && val.length > 0) data[key.trim()] = val.join(': ').trim();
    });

    const op = data['OP'] || 'Operação Administrativa';
    const ctx = data['CTX'] || 'Sistema';
    const val = data['VAL'] || data['VALOR'] || 'R$ 0,00';
    let det = data['DET'] || 'Solicitação de liberação para ação restrita.';

    // Fallback se não estiver em formato de chaves (labels legados ou manuais)
    if (!data['OP'] && label.includes('ID: ')) {
      const legacyId = label.split('ID: ')[1]?.split(' |')[0]?.trim();
      return `(AÇÃO ${existingRequest?.protocol_id || 'REQ-PENDENTE'}) –
Usuário: ${currentUser?.name || 'Operador'}
Operação: Ação Manual Restrita
Contexto: Módulo Interno
Detalhes: Solicitação para o registro REF: ${legacyId?.slice(0, 8) || 'S/R'}
Valor envolvido: ${val}`;
    }

    const protocol = existingRequest ? existingRequest.protocol_id : 'REQ-PENDENTE';

    return `(AÇÃO ${protocol}) –
Usuário: ${currentUser?.name || 'Operador'}
Operação: ${op}
Contexto: ${ctx}
Detalhes: ${det}
Valor envolvido: ${val}`;
  };

  if (!isOpen) return null;

  const handleRequest = async () => {
    if (!currentUser || isDuplicate) return;
    try {
      await authorizationService.requestAuthorization(actionKey, actionLabel, currentUser);
      refreshRequests(); // Atualização imediata local para feedback instantâneo
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert("Erro ao solicitar: " + err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isDuplicate) {
          e.preventDefault();
          handleRequest();
        }
      }}
      tabIndex={-1}
    >
      <div className="enterprise-card w-full max-w-lg overflow-hidden shadow-2xl border-slate-700 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-brand-warning/5">
          <h2 className="text-lg font-black flex items-center gap-3 text-white uppercase tracking-widest"><Lock className="text-brand-warning" size={22} /> Controle de Segurança</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
        </div>
        <div className="p-8 space-y-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2 ${isDuplicate ? 'border-brand-success/30 bg-brand-success/5' : 'border-brand-warning/30 bg-brand-warning/5'}`}>
            {isDuplicate ? <CheckCircle2 className="text-brand-success" size={32} /> : <AlertTriangle className="text-brand-warning" size={32} />}
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{isDuplicate ? 'Análise em Andamento' : 'Ação Bloqueada'}</h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">Esta operação exige revisão narrativa e liberação remota de um supervisor.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-left space-y-4 shadow-inner">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-2">
              <span className="flex items-center gap-1.5"><Info size={12} className="text-brand-warning" /> Protocolo Operacional</span>
              <span className="flex items-center gap-1"><Clock size={10} /> {existingRequest ? 'SOLICITADO ÀS ' + new Date(existingRequest.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()}</span>
            </div>
            <pre className={`text-[11px] font-bold uppercase leading-relaxed whitespace-pre-wrap font-sans ${isDuplicate ? 'text-brand-success' : 'text-white'}`}>
              {getHumanExplanation(actionLabel)}
            </pre>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={onClose} className="py-4 border border-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-800 hover:text-white transition-all">VOLTAR</button>
            <button
              type="button"
              onClick={handleRequest}
              disabled={isDuplicate}
              className={`py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all ${isDuplicate
                ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
                : 'bg-brand-warning text-black shadow-brand-warning/20 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {isDuplicate ? 'AGUARDANDO GESTOR' : 'SOLICITAR AGORA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestAuthorizationModal;