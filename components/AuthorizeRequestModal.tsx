import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ShieldCheck, UserCheck, Lock, ChevronRight, AlertCircle, Key, Clock, CheckCircle2, Loader2, User as UserIcon, Info, Hash } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { authorizationService } from '../services/authorizationService';
import { db } from '../services/dbService';
import { AuthorizationRequest, PermissionModule } from '../types';

interface AuthorizeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthorizeRequestModal: React.FC<AuthorizeRequestModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, pendingRequests, refreshRequests } = useAppContext();
  const [selectedRequest, setSelectedRequest] = useState<AuthorizationRequest | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Filtra apenas o que o gestor precisa ver no momento (PENDING)
  const actualPendingRequests = useMemo(() =>
    pendingRequests.filter(r => r.status === 'PENDING'),
    [pendingRequests]
  );

  useEffect(() => {
    if (isOpen && currentUser && !email) setEmail(currentUser.email);
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedRequest(null); setEmail(''); setPassword(''); setError(''); refreshRequests(); onClose();
  };

  const getHumanExplanation = (request: AuthorizationRequest) => {
    if (!request || !request.action_label) return 'DETALHES NÃO INFORMADOS';

    const label = request.action_label;
    const parts = label.split(' | ');
    const data: Record<string, string> = {};
    parts.forEach(p => {
      const [key, ...val] = p.split(': ');
      if (key && val.length > 0) data[key.trim()] = val.join(': ').trim();
    });

    const op = data['OP'] || 'Operação Restrita';
    const ctx = data['CTX'] || 'Módulo Administrativo';
    const val = data['VAL'] || data['VALOR'] || 'R$ 0,00';
    let det = data['DET'] || 'Solicitação para alteração ou remoção de registro.';

    return `(AÇÃO ${request.protocol_id}) –
Usuário: ${request.requested_by_name}
Operação: ${op}
Contexto: ${ctx}
Detalhes: ${det}
Valor envolvido: ${val}`;
  };

  const handleApprove = async () => {
    if (!selectedRequest || !currentUser) return;
    setIsProcessing(true);
    setError('');
    try {
      const manager = db.verifyCredentials(email, password, PermissionModule.ACTION_EDIT);
      if (!manager) {
        setError('Credenciais de gestor inválidas ou sem permissão de edição.');
        setIsProcessing(false);
        return;
      }
      await authorizationService.approveAuthorization(selectedRequest.id, manager);
      refreshRequests();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Falha na comunicação com o banco de dados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedRequest || !currentUser) return;
    setIsProcessing(true);
    setError('');
    try {
      const manager = db.verifyCredentials(email, password, PermissionModule.ACTION_EDIT);
      if (!manager) {
        setError('Credenciais de gestor inválidas.');
        setIsProcessing(false);
        return;
      }
      await authorizationService.denyAuthorization(selectedRequest.id, manager);
      refreshRequests();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao processar recusa.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
      <div className="enterprise-card w-full max-w-3xl overflow-hidden shadow-2xl border-slate-700">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-brand-success/5">
          <h2 className="text-lg font-black flex items-center gap-3 text-white uppercase tracking-widest"><ShieldCheck className="text-brand-success" size={24} /> Centro de Revisão Remota</h2>
          <button onClick={handleClose} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
        </div>
        <div className="flex flex-col md:flex-row h-[580px]">
          <div className="w-full md:w-64 border-r border-slate-800 bg-slate-900/30 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fila de Revisão</div>
            {actualPendingRequests.map(req => (
              <button key={req.id} onClick={() => { setSelectedRequest(req); setError(''); }} className={`w-full p-4 border-b border-slate-800 text-left transition-all ${selectedRequest?.id === req.id ? 'bg-brand-success/10 text-brand-success border-r-4 border-r-brand-success' : 'text-slate-400 hover:bg-slate-800'}`}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-black uppercase truncate">{req.action_key.replace(/_/g, ' ')}</p>
                  <span className="text-[8px] font-black bg-slate-950 px-1.5 py-0.5 rounded text-brand-success border border-brand-success/20">{req.protocol_id}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 opacity-60">
                  <UserIcon size={10} />
                  <p className="text-[9px] font-bold uppercase truncate">{req.requested_by_name}</p>
                </div>
              </button>
            ))}
            {actualPendingRequests.length === 0 && (
              <div className="p-8 text-center opacity-20"><CheckCircle2 size={32} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Fila Vazia</p></div>
            )}
          </div>
          <div className="flex-1 bg-brand-dark p-8 flex flex-col justify-between overflow-hidden">
            {selectedRequest ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-2 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner flex-1 mr-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-brand-success border border-slate-700"><UserIcon size={24} /></div>
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Colaborador Solicitante</p>
                      <p className="text-sm font-black text-white uppercase">{selectedRequest.requested_by_name}</p>
                      <p className="text-[9px] text-slate-600 font-bold uppercase">VIA (PEDIDO {selectedRequest.protocol_id})</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Info size={14} className="text-brand-success" /> Descritivo da Operação</p>
                  <div className="bg-slate-900 p-5 rounded-2xl border-l-4 border-l-brand-success shadow-inner">
                    <pre className="text-xs text-slate-200 font-bold leading-relaxed uppercase whitespace-pre-wrap font-sans">
                      {getHumanExplanation(selectedRequest)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800/50">
                  <p className="text-[10px] font-black text-brand-success uppercase tracking-widest flex items-center gap-2"><Lock size={12} /> Chave de Segurança Master</p>
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      type="email"
                      placeholder="E-mail Gestor"
                      className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs focus:border-brand-success outline-none transition-all"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleApprove()}
                    />
                    <input
                      ref={passwordRef}
                      type="password"
                      placeholder="Senha Master"
                      className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs focus:border-brand-success outline-none transition-all"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleApprove()}
                    />
                  </div>
                  {error && (
                    <div className="p-3 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-center gap-3">
                      <AlertCircle className="text-brand-error shrink-0" size={16} />
                      <p className="text-[9px] text-brand-error font-black uppercase leading-tight">{error}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button onClick={handleDeny} disabled={isProcessing} className="py-4 border border-slate-800 rounded-xl font-black text-[10px] text-brand-error uppercase tracking-widest hover:bg-brand-error/10 transition-all disabled:opacity-50">RECUSAR AÇÃO</button>
                  <button onClick={handleApprove} disabled={isProcessing || !email || !password} className="py-4 bg-brand-success text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-success/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                    {isProcessing ? 'PROCESSANDO...' : 'LIBERAR AGORA'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-8">
                <UserCheck size={80} className="mb-6" />
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Pronto para Revisão</h3>
                <p className="text-xs mt-3 font-medium leading-relaxed">Selecione um pedido para visualizar a narrativa e aplicar a chave de segurança.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorizeRequestModal;