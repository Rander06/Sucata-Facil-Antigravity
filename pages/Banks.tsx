import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { Bank, PermissionModule, AuthorizationRequest } from '../types';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import {
  Landmark,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Save,
  Star,
  Hash,
  Activity,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Check
} from 'lucide-react';

const Banks: React.FC = () => {
  const { currentUser, pendingRequests, refreshRequests } = useAppContext();
  const companyId = currentUser?.companyId || '';

  const [banks, setBanks] = useState<Bank[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // CONTROLE DE PEDIDOS DE LIBERAÇÃO REMOTA
  const [isRequestAuthModalOpen, setIsRequestAuthModalOpen] = useState(false);
  const [authRequestData, setAuthRequestData] = useState<{ key: string, label: string } | null>(null);

  const [formData, setFormData] = useState<Partial<Bank>>({
    name: '',
    code: '',
    agency: '',
    account: '',
    isDefault: false
  });

  const loadBanks = useCallback(() => {
    setBanks(db.queryTenant<Bank>('banks', companyId));
  }, [companyId]);

  useEffect(() => { loadBanks(); }, [loadBanks]);

  // MONITOR DE LIBERAÇÕES REMOTAS (ACT AS BACKEND JOBS)
  useEffect(() => {
    if (!currentUser) return;
    const findApproved = (key: string) => db.query<AuthorizationRequest>('authorization_requests' as any, r => r.status === 'APPROVED' && r.action_key === key && r.requested_by_id === currentUser.id).sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())[0];

    const approvedEdit = findApproved('EDITAR_BANCO');
    if (approvedEdit) {
      db.update('authorization_requests' as any, approvedEdit.id, { status: 'PROCESSED' } as any);
      const id = approvedEdit.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
      const dataRaw = approvedEdit.action_label.split('JSON: ')[1]?.trim();
      if (id && dataRaw) {
        db.update('banks', id, JSON.parse(dataRaw)); loadBanks(); setShowModal(false); setEditingId(null);
      }
    }
    const approvedDelete = findApproved('EXCLUIR_BANCO');
    if (approvedDelete) {
      db.update('authorization_requests' as any, approvedDelete.id, { status: 'PROCESSED' } as any);
      const id = approvedDelete.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
      if (id) {
        db.delete('banks', id); loadBanks();
      }
    }
  }, [pendingRequests, currentUser, loadBanks]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setAuthRequestData({
        key: 'EDITAR_BANCO',
        label: `OP: EDIÇÃO DE CONTA | ID: #${editingId.slice(-5)} | CTX: GESTÃO DE CONTAS | DET: Ajuste nas informações da conta bancária ${formData.name} para conciliação bancária. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${editingId} | JSON: ${JSON.stringify(formData)}`
      });
      setIsRequestAuthModalOpen(true);
    } else {
      db.insert<Bank>('banks', { ...formData, companyId }); loadBanks(); setShowModal(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div><h2 className="text-2xl font-black flex items-center gap-3 text-white uppercase tracking-tight"><Landmark className="text-brand-success" /> Instituições Bancárias</h2></div>
        <button onClick={() => { setEditingId(null); setFormData({ name: '', code: '', agency: '', account: '', isDefault: false }); setShowModal(true); }} className="bg-brand-success text-white py-3.5 px-6 rounded-xl shadow-xl font-black flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest transition-all"><Plus size={18} /><span>Cadastrar Banco</span></button>
      </header>

      <div className="enterprise-card overflow-hidden border-slate-800 shadow-2xl mx-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800"><th className="px-6 py-5">Banco</th><th className="px-6 py-5">Cód</th><th className="px-6 py-5">Agência / Conta</th><th className="px-6 py-5 text-center">Padrão</th><th className="px-6 py-5 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {banks.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center opacity-20 font-black uppercase tracking-widest">Nenhum banco cadastrado</td></tr>
              ) : banks.map(b => (
                <tr key={b.id} className="hover:bg-slate-800/20 transition-all text-xs">
                  <td className="px-6 py-4 font-black text-slate-200 uppercase">{b.name}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">{b.code || '---'}</td>
                  <td className="px-6 py-4 text-slate-400">AG: {b.agency} | CC: {b.account}</td>
                  <td className="px-6 py-4 text-center">
                    {b.isDefault && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-success/10 text-brand-success border border-brand-success/20"><Star size={12} fill="currentColor" /></span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingId(b.id); setFormData({ ...b }); setShowModal(true); }} className="p-2.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => {
                        setAuthRequestData({
                          key: 'EXCLUIR_BANCO',
                          label: `OP: EXCLUSÃO DE BANCO | ID: #${b.id.slice(-5)} | CTX: GESTÃO DE CONTAS | DET: Remoção permanente da conta bancária ${b.name} da estrutura da empresa. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${b.id}`
                        });
                        setIsRequestAuthModalOpen(true);
                      }} className="p-2.5 bg-brand-error/10 text-brand-error rounded-lg hover:bg-brand-error/20 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="absolute inset-0 z-[40] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="enterprise-card w-full max-md overflow-hidden shadow-2xl border-slate-700 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                <Landmark className="text-brand-success" size={24} />
                {editingId ? 'Ajustar Banco' : 'Novo Banco'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={28} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nome do Banco</label>
                <input
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-brand-success transition-all"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  placeholder="EX: BANCO DO BRASIL"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block truncate">Cód (Compe)</label>
                  <input
                    className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-brand-success transition-all text-center"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="001"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Agência</label>
                  <input
                    className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-brand-success transition-all text-center"
                    value={formData.agency}
                    onChange={e => setFormData({ ...formData, agency: e.target.value })}
                    placeholder="0001"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Conta</label>
                  <input
                    className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-brand-success transition-all text-center"
                    value={formData.account}
                    onChange={e => setFormData({ ...formData, account: e.target.value })}
                    placeholder="12345-6"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label
                  onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                  className="flex items-center gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-xl cursor-pointer group hover:bg-slate-900/50 transition-all"
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all ${formData.isDefault ? 'bg-brand-success border-brand-success' : 'border-slate-700 bg-slate-950'}`}>
                    {formData.isDefault && <Check size={16} className="text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white transition-colors tracking-widest">Definir como banco padrão</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-brand-success/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <Save size={18} />
                {editingId ? 'PEDIR LIBERAÇÃO EDIÇÃO' : 'EFETIVAR REGISTRO'}
              </button>
            </form>
          </div>
        </div>
      )}
      <RequestAuthorizationModal isOpen={isRequestAuthModalOpen} onClose={() => setIsRequestAuthModalOpen(false)} actionKey={authRequestData?.key || ''} actionLabel={authRequestData?.label || ''} />
    </div>
  );
};

export default Banks;