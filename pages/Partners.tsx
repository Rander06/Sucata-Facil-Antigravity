import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { Partner, PermissionModule, AuthorizationRequest } from '../types';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  UserCircle,
  X,
  Edit2,
  Trash2,
  Eye,
  Save,
  CheckCircle2,
  Building2,
  Users2
} from 'lucide-react';

const Partners: React.FC = () => {
  const { currentUser, pendingRequests, refreshRequests } = useAppContext();
  const companyId = currentUser?.companyId || '';

  const [partners, setPartners] = useState<Partner[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // CONTROLE DE PEDIDOS DE LIBERAÇÃO REMOTA
  const [isRequestAuthModalOpen, setIsRequestAuthModalOpen] = useState(false);
  const [authRequestData, setAuthRequestData] = useState<{ key: string, label: string } | null>(null);

  const [formData, setFormData] = useState<Partial<Partner>>({ name: '', type: 'supplier', document: '', phone: '' });

  const loadPartners = useCallback(() => {
    setPartners(db.queryTenant<Partner>('partners', companyId));
  }, [companyId]);

  useEffect(() => { loadPartners(); }, [loadPartners]);

  // MONITOR DE LIBERAÇÕES REMOTAS (ACT AS BACKEND JOBS)
  useEffect(() => {
    if (!currentUser) return;
    const findApproved = (key: string) => db.query<AuthorizationRequest>('authorization_requests' as any, r => r.status === 'APPROVED' && r.action_key === key && r.requested_by_id === currentUser.id).sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())[0];

    const approvedEdit = findApproved('EDITAR_PARCEIRO');
    if (approvedEdit) {
      db.update('authorization_requests' as any, approvedEdit.id, { status: 'PROCESSED' } as any);
      const id = approvedEdit.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
      const dataRaw = approvedEdit.action_label.split('JSON: ')[1]?.trim();
      if (id && dataRaw) {
        db.update('partners', id, JSON.parse(dataRaw));
        loadPartners(); setShowModal(false); setEditingId(null);
      }
    }
    const approvedDelete = findApproved('EXCLUIR_PARCEIRO');
    if (approvedDelete) {
      db.update('authorization_requests' as any, approvedDelete.id, { status: 'PROCESSED' } as any);
      const id = approvedDelete.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
      if (id) {
        db.delete('partners', id); loadPartners();
      }
    }
  }, [pendingRequests, currentUser, loadPartners]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') return;
    if (modalMode === 'edit' && editingId) {
      setAuthRequestData({
        key: 'EDITAR_PARCEIRO',
        label: `OP: EDIÇÃO DE CADASTRO | ID: #${editingId.slice(-5)} | CTX: GESTÃO DE PARCEIROS | DET: Atualização dos dados cadastrais do parceiro ${formData.name} para integridade fiscal. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${editingId} | JSON: ${JSON.stringify(formData)}`
      });
      setIsRequestAuthModalOpen(true);
    } else {
      db.insert<Partner>('partners', { ...formData, companyId, usuario_id: currentUser?.id });
      db.logAction(companyId, currentUser!.id, currentUser!.name, 'PARTNER_ADD', `CADASTRADO: Novo parceiro "${formData.name}"`);
      setShowModal(false); loadPartners();
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div><h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 text-white uppercase tracking-tight"><Users className="text-brand-success" /> Gestão de Parceiros</h1></div>
        <button onClick={() => { setModalMode('create'); setFormData({ name: '', type: 'supplier', document: '', phone: '' }); setShowModal(true); }} className="bg-brand-success text-white py-4 px-8 rounded-2xl shadow-xl font-black flex items-center justify-center gap-3 text-sm uppercase tracking-widest transition-all">
          <Plus size={22} /><span>Novo Cadastro</span>
        </button>
      </header>

      <div className="enterprise-card overflow-hidden border-slate-800 mx-1 shadow-2xl bg-slate-900/20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center gap-4">
          <div className="flex items-center gap-4 bg-brand-dark p-3 px-5 rounded-2xl border-2 border-slate-800 max-w-md w-full group focus-within:border-brand-success transition-all">
            <Search size={20} className="text-slate-500" /><input type="text" placeholder="Buscar parceiro..." className="bg-transparent border-none focus:ring-0 text-sm flex-1 outline-none text-white font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px] table-fixed">
            <thead><tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]"><th className="px-8 py-6 w-[40%]">Parceiro / Empresa</th><th className="px-8 py-6 w-[25%]">Documento</th><th className="px-8 py-6 w-[15%] text-center">Tipo</th><th className="px-8 py-6 w-[20%] text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {partners.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                <tr key={p.id} className="hover:bg-slate-800/20 transition-all text-xs">
                  <td className="px-8 py-5 w-[40%] font-black uppercase text-slate-200">{p.name}</td>
                  <td className="px-8 py-5 w-[25%] font-mono text-slate-400">{p.document}</td>
                  <td className="px-8 py-5 text-center w-[15%] uppercase">{p.type}</td>
                  <td className="px-8 py-5 text-right w-[20%]">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setModalMode('view'); setFormData({ ...p }); setShowModal(true); }} className="p-3 bg-slate-800 text-slate-400 rounded-xl"><Eye size={20} /></button>
                      <button onClick={() => { setModalMode('edit'); setEditingId(p.id); setFormData({ ...p }); setShowModal(true); }} className="p-3 bg-brand-success/10 text-brand-success rounded-xl"><Edit2 size={20} /></button>
                      <button onClick={() => {
                        setAuthRequestData({
                          key: 'EXCLUIR_PARCEIRO',
                          label: `OP: EXCLUSÃO DE PARCEIRO | ID: #${p.id.slice(-5)} | CTX: GESTÃO DE PARCEIROS | DET: Remoção definitiva do registro do parceiro ${p.name} por descontinuidade comercial. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${p.id}`
                        });
                        setIsRequestAuthModalOpen(true);
                      }} className="p-3 bg-brand-error/10 text-brand-error rounded-xl"><Trash2 size={20} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="absolute inset-0 z-[40] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in overflow-y-auto">
          <div className="enterprise-card w-full max-xl overflow-hidden shadow-2xl border-slate-700 my-auto">
            <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center"><h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest"><UserCircle size={24} /> {modalMode === 'create' ? 'Novo Parceiro' : modalMode === 'edit' ? 'Editar Dados' : 'Visualização'}</h2><button onClick={() => setShowModal(false)} className="p-2 text-slate-500 hover:text-white transition-all"><X size={32} /></button></div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              {/* Nome / Razão Social */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Nome / Razão Social</label>
                <input required disabled={modalMode === 'view'} className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-brand-success" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" />
              </div>

              {/* Tipo de Parceiro */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Tipo de Parceiro</label>
                <select
                  disabled={modalMode === 'view'}
                  className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-brand-success appearance-none"
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="supplier">FORNECEDOR</option>
                  <option value="customer">CLIENTE</option>
                  <option value="both">AMBOS (FORNECEDOR/CLIENTE)</option>
                </select>
              </div>

              {/* Documento e Telefone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">CPF / CNPJ</label>
                  <input
                    required
                    disabled={modalMode === 'view'}
                    className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-brand-success"
                    value={formData.document}
                    onChange={e => setFormData({ ...formData, document: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Telefone de Contato</label>
                  <input
                    required
                    disabled={modalMode === 'view'}
                    className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-brand-success"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {modalMode !== 'view' && (
                <button type="submit" className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-4">
                  {modalMode === 'edit' ? 'PEDIR LIBERAÇÃO EDIÇÃO' : 'SALVAR CADASTRO'}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      <RequestAuthorizationModal isOpen={isRequestAuthModalOpen} onClose={() => setIsRequestAuthModalOpen(false)} actionKey={authRequestData?.key || ''} actionLabel={authRequestData?.label || ''} />
    </div>
  );
};

export default Partners;