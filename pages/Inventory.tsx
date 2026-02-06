
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { Material, PermissionModule, AuthorizationRequest, RemoteAuthorization } from '../types';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import { normalizeText } from '../utils/textHelper';
import { formatCurrency } from '../utils/currencyHelper';
import {
  Package,
  Plus,
  Search,
  TrendingUp,
  Scale,
  AlertTriangle,
  X,
  Edit2,
  Trash2,
  Eye,
  History as HistoryIcon,
  Save,
  ShieldAlert,
  Loader2
} from 'lucide-react';

const Inventory: React.FC = () => {
  const { currentUser, pendingRequests, refreshRequests, dataVersion } = useAppContext();
  const companyId = currentUser?.companyId || currentUser?.company_id || '';
  const isMaster = currentUser?.role === 'SUPER_ADMIN'; // Only SUPER_ADMIN bypasses auth now

  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setSearchModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [adjustModal, setAdjustModal] = useState<{ show: boolean, material: Material | null, newVal: string }>({ show: false, material: null, newVal: '' });

  const [isRequestEditAuthModalOpen, setIsRequestEditAuthModalOpen] = useState(false);
  const [isRequestDeleteAuthModalOpen, setIsRequestDeleteAuthModalOpen] = useState(false);
  const [isRequestAdjustAuthModalOpen, setIsRequestAdjustAuthModalOpen] = useState(false);

  const [editToRequest, setEditToRequest] = useState<any>(null);
  const [deleteIdToRequest, setDeleteIdToRequest] = useState<string | null>(null);
  const [adjustToRequest, setAdjustToRequest] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<Material>>({
    name: '', unit: 'KG', stock: 0, minStock: 10, maxStock: 1000, buyPrice: 0, sellPrice: 0
  });

  const loadMaterials = useCallback(() => {
    setMaterials(db.queryTenant<Material>('materials', companyId));
  }, [companyId]);

  useEffect(() => { loadMaterials(); }, [loadMaterials, dataVersion]);

  useEffect(() => {
    if (!currentUser) return;
    const findApproved = (key: string) => db.query<AuthorizationRequest>('authorization_requests' as any, r =>
      r.status === 'APPROVED' && r.action_key === key && r.requested_by_id === currentUser.id
    ).sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())[0];

    const approvedEdit = findApproved(RemoteAuthorization.AUTH_ESTOQUE_EDIT);
    if (approvedEdit) {
      db.update('authorization_requests' as any, approvedEdit.id, { status: 'PROCESSED' } as any);
      const parts = approvedEdit.action_label.split('REAL_ID: ');
      const id = parts[1]?.split(' |')[0]?.trim();
      const dataRaw = approvedEdit.action_label.split('JSON: ')[1]?.trim();
      if (id && dataRaw) {
        db.update('materials', id, JSON.parse(dataRaw));
        db.logAction(companyId, approvedEdit.responded_by_id!, approvedEdit.responded_by_name!, 'STOCK_EDIT_EXECUTED', `Editou material #${id.slice(-5)}`);
        loadMaterials(); setSearchModal(false); setEditingId(null);
      }
    }

    const approvedDelete = findApproved(RemoteAuthorization.AUTH_ESTOQUE_DELETE);
    if (approvedDelete) {
      db.update('authorization_requests' as any, approvedDelete.id, { status: 'PROCESSED' } as any);
      const parts = approvedDelete.action_label.split('REAL_ID: ');
      const id = parts[1]?.split(' |')[0]?.trim();
      if (id) {
        db.delete('materials', id);
        db.logAction(companyId, approvedDelete.responded_by_id!, approvedDelete.responded_by_name!, 'STOCK_DELETE_EXECUTED', `Excluiu material #${id.slice(-5)}`);
        loadMaterials();
      }
    }

    const approvedAdjust = findApproved(RemoteAuthorization.AUTH_ESTOQUE_ADJUST);
    if (approvedAdjust) {
      db.update('authorization_requests' as any, approvedAdjust.id, { status: 'PROCESSED' } as any);

      const label = approvedAdjust.action_label;
      const id = label.split('REAL_ID: ')[1]?.trim();

      // Extração robusta do valor numérico ignorando "para" descritivos
      const valPart = label.split('VAL: ')[1]?.split(' | REAL_ID')[0];
      const newValStr = valPart?.split(' para ')[1]?.trim(); // Espaços para evitar falsos positivos

      // Remove formatação brasileira para parseFloat padrão
      const val = parseFloat(newValStr?.replace(/\./g, '').replace(',', '.') || '0');

      if (id && !isNaN(val)) {
        db.update('materials', id, { stock: val });
        db.logAction(companyId, approvedAdjust.responded_by_id!, approvedAdjust.responded_by_name!, 'STOCK_ADJUST_EXECUTED', `Ajustou saldo ID ${id.slice(-5)} para ${val}`);
        loadMaterials();
      }
    }
  }, [pendingRequests, currentUser, companyId, loadMaterials]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') return;

    const dbPayload = {
      name: formData.name,
      unit: formData.unit,
      stock: formData.stock,
      min_stock: formData.minStock,
      max_stock: formData.maxStock,
      buy_price: formData.buyPrice,
      sell_price: formData.sellPrice,
      updated_at: new Date().toISOString()
    };

    if (modalMode === 'edit' && editingId) {
      // PROCESSO PADRONIZADO: Todos os perfis (incluindo SUPER_ADMIN) devem solicitar autorização
      // A execução da edição ocorre via useEffect ao detectar status 'APPROVED'
      const original = materials.find(m => m.id === editingId);
      if (original) {
        const delta: any = {};
        let hasChanges = false;

        if (formData.name !== original.name) { delta.name = formData.name; hasChanges = true; }
        if (formData.unit !== original.unit) { delta.unit = formData.unit; hasChanges = true; }
        if (formData.minStock !== (original.min_stock || original.minStock)) { delta.min_stock = formData.minStock; hasChanges = true; }
        if (formData.maxStock !== (original.max_stock || original.maxStock)) { delta.max_stock = formData.maxStock; hasChanges = true; }
        if (formData.buyPrice !== (original.buy_price || original.buyPrice)) { delta.buy_price = formData.buyPrice; hasChanges = true; }
        if (formData.sellPrice !== (original.sell_price || original.sellPrice)) { delta.sell_price = formData.sellPrice; hasChanges = true; }
        if (formData.stock !== original.stock) { delta.stock = formData.stock; hasChanges = true; }

        if (!hasChanges) return setSearchModal(false);
        setEditToRequest({ id: editingId, name: original.name, data: delta });
        setIsRequestEditAuthModalOpen(true);
      }
      return;

      // Código de bypass direto removido para padronização


    } else {
      // CREATE MODE
      if (!isMaster && !currentUser?.permissions.includes(PermissionModule.STOCK)) {
        alert("Você não tem permissão para cadastrar novos materiais.");
        return;
      }
      await db.insert<Material>('materials', { ...dbPayload, company_id: companyId, companyId, usuario_id: currentUser?.id, created_at: new Date().toISOString() });
      db.logAction(companyId, currentUser!.id, currentUser!.name, 'STOCK_ADD', `CADASTRADO: Novo material "${formData.name}"`);
      setSearchModal(false); loadMaterials();
    }
  };

  const handleAdjustStock = () => {
    if (!adjustModal.material) return;
    const newVal = parseFloat(adjustModal.newVal);
    if (isNaN(newVal)) return;

    // PADRÃO: Solicita autorização sempre (Execução via useEffect)
    setAdjustToRequest({ id: adjustModal.material.id, val: newVal, name: adjustModal.material.name, oldVal: adjustModal.material.stock });
    setIsRequestAdjustAuthModalOpen(true);
    setAdjustModal({ show: false, material: null, newVal: '' });
  };

  const handleDelete = (material: Material) => {
    // PADRÃO: Solicita autorização sempre (Execução via useEffect)
    setDeleteIdToRequest(material.id);
    setIsRequestDeleteAuthModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8 p-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 text-white uppercase tracking-tight"><Package className="text-brand-success" /> Estoque</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Gestão central de materiais e patrimônio da unidade.</p>
        </div>
        <button onClick={() => { setModalMode('create'); setFormData({ name: '', unit: 'KG', stock: 0, minStock: 10, maxStock: 1000, buyPrice: 0, sellPrice: 0 }); setSearchModal(true); }} className="bg-brand-success text-white py-4 px-8 rounded-2xl shadow-xl font-black flex items-center justify-center gap-3 text-sm uppercase tracking-widest transition-all">
          <Plus size={22} /><span>Cadastrar Material</span>
        </button>
      </header>



      <div className="enterprise-card border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-4">
          <div className="flex items-center gap-4 bg-brand-dark p-3 px-5 rounded-2xl border-2 border-slate-800 max-w-md w-full group focus-within:border-brand-success transition-all">
            <Search size={20} className="text-slate-500" /><input type="text" id="search-materials" name="search" autoComplete="new-password" placeholder="Pesquisar material..." className="bg-transparent border-none focus:ring-0 text-sm flex-1 outline-none text-white font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1000px]">
            <thead><tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]"><th className="px-8 py-6">Material & Preço Médio</th><th className="px-8 py-6 text-center">Saldo Real</th><th className="px-8 py-6 text-center">Indicador</th><th className="px-8 py-6 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {materials.filter(m => normalizeText(m.name).includes(normalizeText(searchTerm))).map(m => {
                const min = m.min_stock || m.minStock || 0;
                const max = m.max_stock || m.maxStock || 1000;
                const displayPercent = m.stock < min ? ((m.stock / (min || 1)) - 1) * 100 : (m.stock / (max || 1)) * 100;
                const stockColorClass = m.stock <= min ? 'text-brand-warning' : (m.stock >= max ? 'text-brand-error' : 'text-brand-success');
                const stockBgClass = m.stock <= min ? 'bg-brand-warning' : (m.stock >= max ? 'bg-brand-error' : 'bg-brand-success');

                return (
                  <tr key={m.id} className="hover:bg-slate-800/20 transition-all group">
                    <td className="px-8 py-5"><p className="font-black text-slate-200 uppercase tracking-tight text-base truncate">{m.name}</p><p className="text-[10px] text-slate-600 uppercase font-bold mt-1 tracking-widest">Preço: R$ {formatCurrency(m.buy_price || m.buyPrice || 0)} / {m.unit}</p></td>
                    <td className={`px-8 py-5 text-center font-black text-lg ${m.stock <= min ? 'text-brand-warning animate-pulse' : stockColorClass}`}>{m.stock.toLocaleString()} <span className="text-xs opacity-40 uppercase">{m.unit}</span></td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-[10px] font-black ${stockColorClass}`}>
                          {Math.round(displayPercent)}%
                        </span>
                        <div className="w-32 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div className={`h-full transition-all duration-500 ${stockBgClass}`} style={{ width: `${Math.min(100, Math.max(0, (m.stock / max) * 100))}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setAdjustModal({ show: true, material: m, newVal: m.stock.toString() })} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl" title="Ajuste"><Scale size={20} /></button>
                        <button onClick={() => { setModalMode('view'); setEditingId(m.id); setFormData({ ...m }); setSearchModal(true); }} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl"><Eye size={20} /></button>
                        <button onClick={() => { setModalMode('edit'); setEditingId(m.id); setFormData({ ...m }); setSearchModal(true); }} className="p-3 bg-brand-success/10 text-brand-success rounded-xl"><Edit2 size={20} /></button>
                        <button onClick={() => handleDelete(m)} className="p-3 bg-brand-error/10 text-brand-error rounded-xl"><Trash2 size={20} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in duration-300">
          <div className="enterprise-card w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl my-auto border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center"><h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest"><Package className="text-brand-success" size={24} /> {modalMode === 'create' ? 'Novo Material' : modalMode === 'edit' ? 'Editar Material' : 'Ficha Técnica'}</h2><button onClick={() => setSearchModal(false)} className="p-2 text-slate-500 hover:text-white transition-all"><X size={32} /></button></div>
            <form onSubmit={handleSave} className="p-8 pb-24 space-y-8" autoComplete="new-password">
              <div className="space-y-3"><label htmlFor="material-name" className="text-xs font-black text-slate-500 uppercase tracking-widest">Nome do Material</label><input required disabled={modalMode === 'view'} id="material-name" name="name" autoComplete="new-password" className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-brand-success" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} placeholder="Ex: Cobre Mel" /></div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3"><label htmlFor="material-unit" className="text-xs font-black text-slate-500 uppercase tracking-widest">Unidade</label><select disabled={modalMode === 'view'} id="material-unit" name="unit" className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-brand-success" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value as any })}><option value="KG">QUILOGRAMA (KG)</option><option value="UN">UNIDADE (UN)</option></select></div>
                <div className="space-y-3"><label htmlFor="material-buyPrice" className="text-xs font-black text-slate-500 uppercase tracking-widest">Preço Compra</label><input type="number" step="0.01" required disabled={modalMode === 'view'} id="material-buyPrice" name="buyPrice" className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold" value={formData.buyPrice || formData.buy_price || 0} onChange={e => setFormData({ ...formData, buyPrice: parseFloat(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3"><label htmlFor="material-minStock" className="text-xs font-black text-slate-500 uppercase tracking-widest">Estoque Mínimo</label><input type="number" step="0.001" required disabled={modalMode === 'view'} id="material-minStock" name="minStock" className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold" value={formData.minStock || formData.min_stock || 0} onChange={e => setFormData({ ...formData, minStock: parseFloat(e.target.value) })} /></div>
                <div className="space-y-3"><label htmlFor="material-maxStock" className="text-xs font-black text-slate-500 uppercase tracking-widest">Estoque Máximo</label><input type="number" step="0.001" required disabled={modalMode === 'view'} id="material-maxStock" name="maxStock" className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold" value={formData.maxStock || formData.max_stock || 0} onChange={e => setFormData({ ...formData, maxStock: parseFloat(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3"><label htmlFor="material-sellPrice" className="text-xs font-black text-slate-500 uppercase tracking-widest">Preço Venda</label><input type="number" step="0.01" required disabled={modalMode === 'view'} id="material-sellPrice" name="sellPrice" className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl text-white font-bold" value={formData.sellPrice || formData.sell_price || 0} onChange={e => setFormData({ ...formData, sellPrice: parseFloat(e.target.value) })} /></div>
                <div className="space-y-3"><label htmlFor="material-stock" className="text-xs font-black text-slate-500 uppercase tracking-widest">Quantidade Atual</label><input type="number" step="0.001" required disabled={modalMode === 'view' || modalMode === 'edit'} id="material-stock" name="stock" className={`w-full border-2 p-5 rounded-2xl text-white font-bold ${modalMode === 'edit' || modalMode === 'view' ? 'bg-slate-800/50 border-slate-700 opacity-60' : 'bg-slate-900 border-slate-800'}`} value={formData.stock} onChange={e => setFormData({ ...formData, stock: parseFloat(e.target.value) })} /></div>
              </div>
              {modalMode !== 'view' && <button type="submit" className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl active:scale-95">{modalMode === 'edit' ? 'PEDIR LIBERAÇÃO ALTERAÇÃO' : 'SALVAR CADASTRO'}</button>}
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE RÁPIDO */}
      {adjustModal.show && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/98 p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-sm p-8 border-slate-700">
            <h2 className="text-xl font-black text-white uppercase text-center mb-6">Ajustar Saldo</h2>
            <p className="text-[10px] text-slate-500 font-black uppercase text-center mb-2">{adjustModal.material?.name}</p>
            <input autoFocus type="number" step="0.001" id="adjust-stock-val" name="adjustStock" className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-white text-3xl font-black text-center outline-none focus:border-brand-success mb-6" value={adjustModal.newVal} onChange={e => setAdjustModal({ ...adjustModal, newVal: e.target.value })} />
            <div className="flex gap-3">
              <button onClick={() => setAdjustModal({ show: false, material: null, newVal: '' })} className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-xl font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={handleAdjustStock} className="flex-1 py-4 bg-brand-success text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-brand-success/20">Solicitar</button>
            </div>
          </div>
        </div>
      )}

      <RequestAuthorizationModal
        isOpen={isRequestEditAuthModalOpen}
        onClose={() => setIsRequestEditAuthModalOpen(false)}
        actionKey={RemoteAuthorization.AUTH_ESTOQUE_EDIT}
        onSuccess={() => { setSearchModal(false); setEditingId(null); }}
        actionLabel={`OP: EDIÇÃO DE MATERIAL | ID: #${editToRequest?.id?.slice(-5) || '00000'} | CTX: ESTOQUE CENTRAL | DET: Edição de preços e configurações técnicas do material ${editToRequest?.name || 'MATERIAL'}. | VAL: ${formatCurrency(0)} para ${formatCurrency(0)} | REAL_ID: ${editToRequest?.id} | JSON: ${JSON.stringify(editToRequest?.data)}`}
      />
      <RequestAuthorizationModal
        isOpen={isRequestDeleteAuthModalOpen}
        onClose={() => setIsRequestDeleteAuthModalOpen(false)}
        actionKey={RemoteAuthorization.AUTH_ESTOQUE_DELETE}
        actionLabel={`OP: EXCLUSÃO DE MATERIAL | ID: #${deleteIdToRequest?.slice(-5) || '00000'} | CTX: ESTOQUE CENTRAL | DET: Remoção permanente do cadastro do material ${materials.find(m => m.id === deleteIdToRequest)?.name || 'MATERIAL'}. | VAL: ${formatCurrency(0)} para ${formatCurrency(0)} | REAL_ID: ${deleteIdToRequest}`}
      />
      <RequestAuthorizationModal
        isOpen={isRequestAdjustAuthModalOpen}
        onClose={() => setIsRequestAdjustAuthModalOpen(false)}
        actionKey={RemoteAuthorization.AUTH_ESTOQUE_ADJUST}
        actionLabel={`OP: AJUSTE DE ESTOQUE | ID: #${adjustToRequest?.id?.slice(-5) || '00000'} | CTX: INVENTÁRIO REAL | DET: Correção manual da quantidade em estoque do material ${adjustToRequest?.name || 'MATERIAL'} para igualar ao pátio. | VAL: ${formatCurrency(adjustToRequest?.oldVal)} para ${formatCurrency(adjustToRequest?.val)} | REAL_ID: ${adjustToRequest?.id}`}
      />
    </div>
  );
};

export default Inventory;
