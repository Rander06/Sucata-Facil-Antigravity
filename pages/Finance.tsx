import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { PaymentTerm, FinanceCategory, PermissionModule, AuthorizationRequest } from '../types';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import {
  Plus,
  X,
  Trash2,
  Save,
  Tag,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  CheckCircle2,
  Edit2,
  MinusCircle,
  PlusCircle,
  Check,
  ShieldAlert,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';

interface FinanceProps {
  mode?: 'full' | 'terms_only' | 'categories_only';
}

const Finance: React.FC<FinanceProps> = ({ mode = 'terms_only' }) => {
  const { currentUser, pendingRequests, refreshRequests, refreshData } = useAppContext();
  const companyId = currentUser?.companyId || currentUser?.company_id || null;

  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);

  const [showTermModal, setShowTermModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [termFormData, setTermFormData] = useState({
    name: '',
    days: 0,
    installments: 1,
    type: 'fixed' as 'fixed' | 'installments',
    show_in_sale: true,
    show_in_purchase: true,
    show_in_settle: false,
    show_in_bank_manual: false,
    show_in_pdv_manual: false,
    show_in_manual_pdv: false,
    show_in_cashier_close: false,
    show_in_opening: false,
    show_in_title_launch: false
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    type: 'both' as 'in' | 'out' | 'both',
    showInSales: true,
    showInPurchases: true,
    showInLiquidation: true,
    show_in_bank_manual: true,
    show_in_pdv_manual: true,
    show_in_title_launch: true
  });

  const [isRequestAuthModalOpen, setIsRequestAuthModalOpen] = useState(false);
  const [authRequestData, setAuthRequestData] = useState<{ key: string, label: string } | null>(null);
  const processedIdsRef = React.useRef<Set<string>>(new Set());

  const loadData = useCallback(() => {
    const terms = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);
    const cats = db.queryTenant<FinanceCategory>('financeCategories', companyId, () => true);
    setPaymentTerms(terms.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    setFinanceCategories(cats.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!currentUser) return;

    const approvedToProcess = pendingRequests.filter(r =>
      r.status === 'APPROVED' && r.requested_by_id === currentUser.id && !processedIdsRef.current.has(r.id)
    );

    if (approvedToProcess.length > 0) {
      const processAll = async () => {
        let needsRefresh = false;
        for (const req of approvedToProcess) {
          try {
            processedIdsRef.current.add(req.id);
            if (req.action_key === 'EXCLUIR_PRAZO_COMERCIAL') {
              const id = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              if (id) { await db.delete('paymentTerms', id); needsRefresh = true; }
            }
            else if (req.action_key === 'EXCLUIR_CATEGORIA_FINANCEIRA') {
              const id = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              if (id) { await db.delete('financeCategories', id); needsRefresh = true; }
            }
            else if (req.action_key === 'EDITAR_PRAZO_COMERCIAL') {
              const id = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              const dataRaw = req.action_label.split('JSON: ')[1]?.trim();
              if (id && dataRaw) { await db.update('paymentTerms', id, JSON.parse(dataRaw)); needsRefresh = true; }
            }
            else if (req.action_key === 'EDITAR_CATEGORIA_FINANCEIRA') {
              const id = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              const dataRaw = req.action_label.split('JSON: ')[1]?.trim();
              if (id && dataRaw) { await db.update('financeCategories', id, JSON.parse(dataRaw)); needsRefresh = true; }
            }

            await db.update('authorization_requests' as any, req.id, { status: 'PROCESSED' } as any);
          } catch (err) {
            console.error("Erro ao processar liberação remota:", err);
          }
        }

        if (needsRefresh) {
          loadData();
          refreshData();
          refreshRequests();
        }
      };

      processAll();
    }
  }, [pendingRequests, currentUser, loadData, refreshData, refreshRequests]);

  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const original = paymentTerms.find(t => t.id === editingId);
      if (original) {
        const delta: any = {};
        let hasChanges = false;
        Object.keys(termFormData).forEach(k => {
          const val = (termFormData as any)[k];
          // Procura o valor original tentando tanto a chave exata quanto a versão camelCase/snakeCase
          const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
          const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());

          const origVal = (original as any)[k] !== undefined ? (original as any)[k] :
            ((original as any)[snakeKey] !== undefined ? (original as any)[snakeKey] : (original as any)[camelKey]);

          if (val !== origVal) { delta[k] = val; hasChanges = true; }
        });
        if (!hasChanges) return setShowTermModal(false);
        setAuthRequestData({
          key: 'EDITAR_PRAZO_COMERCIAL',
          label: `OP: EDIÇÃO DE PRAZO | ID: #${editingId.slice(-5)} | CTX: FINANCEIRO ESTRUTURAL | DET: Alteração das condições de vencimento e parcelamento do prazo ${original.name}. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${editingId} | JSON: ${JSON.stringify(delta)}`
        });
        setIsRequestAuthModalOpen(true); setShowTermModal(false);
      }
    } else {
      await db.insert('paymentTerms', { ...termFormData, companyId });
      loadData(); refreshData(); setShowTermModal(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategoryId) {
      const original = financeCategories.find(c => c.id === editingCategoryId);
      if (original) {
        const delta: any = {};
        let hasChanges = false;
        Object.keys(categoryFormData).forEach(k => {
          const val = (categoryFormData as any)[k];
          const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
          const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());

          const origVal = (original as any)[k] !== undefined ? (original as any)[k] :
            ((original as any)[snakeKey] !== undefined ? (original as any)[snakeKey] : (original as any)[camelKey]);

          if (val !== origVal) { delta[k] = val; hasChanges = true; }
        });
        if (!hasChanges) return setShowCategoryModal(false);
        setAuthRequestData({
          key: 'EDITAR_CATEGORIA_FINANCEIRA',
          label: `OP: EDIÇÃO DE CATEGORIA | ID: #${editingCategoryId.slice(-5)} | CTX: PLANO DE CONTAS | DET: Alteração na classificação e finalidade da categoria ${original.name}. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${editingCategoryId} | JSON: ${JSON.stringify(delta)}`
        });
        setIsRequestAuthModalOpen(true); setShowCategoryModal(false);
      }
    } else {
      await db.insert('financeCategories', { ...categoryFormData, companyId, is_default: false });
      loadData(); refreshData(); setShowCategoryModal(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in pb-10">

      {/* SEÇÃO: PRAZOS COMERCIAIS */}
      {(mode === 'full' || mode === 'terms_only') && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 mx-1">
            <div className="flex items-center gap-3">
              <CreditCard className="text-brand-success" size={20} />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Prazos e Condições</h3>
            </div>
            <button onClick={() => {
              setEditingId(null);
              setTermFormData({ name: '', days: 0, installments: 1, type: 'fixed', show_in_sale: true, show_in_purchase: true, show_in_settle: false, show_in_bank_manual: false, show_in_pdv_manual: false, show_in_manual_pdv: false, show_in_cashier_close: false, show_in_opening: false });
              setShowTermModal(true);
            }} className="bg-brand-success text-white py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all hover:bg-brand-success/90 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
              <Plus size={18} />
              <span>Novo Prazo</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mx-1">
            {paymentTerms.map(term => (
              <div key={term.id} className="enterprise-card p-6 border-slate-800 flex justify-between items-center group bg-slate-900/30 hover:border-brand-success transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-200 uppercase tracking-tight">{term.name}</p>
                    {(term.isDefault || term.is_default) && <span className="text-[8px] text-brand-success font-black uppercase bg-brand-success/10 px-1.5 py-0.5 rounded border border-brand-success/20">SISTEMA</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">{term.days} DIAS • {term.installments} PARCELAS</p>
                </div>
                {!(term.isDefault || term.is_default) && (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingId(term.id);
                      const isManualPdv = term.show_in_pdv_manual || (term as any).showInPdvManual || term.show_in_manual_pdv || (term as any).showInManualPdv || false;
                      setTermFormData({
                        name: term.name, days: term.days, installments: term.installments, type: term.type as any,
                        show_in_sale: term.show_in_sale ?? (term as any).showInSale ?? true,
                        show_in_purchase: term.show_in_purchase ?? (term as any).showInPurchase ?? true,
                        show_in_settle: term.show_in_settle ?? (term as any).showInSettle ?? false,
                        show_in_bank_manual: term.show_in_bank_manual ?? (term as any).showInBankManual ?? false,
                        show_in_pdv_manual: isManualPdv,
                        show_in_manual_pdv: isManualPdv,
                        show_in_cashier_close: term.show_in_cashier_close ?? (term as any).showInCashierClose ?? false,
                        show_in_opening: term.show_in_opening ?? (term as any).showInOpening ?? false,
                        show_in_title_launch: term.show_in_title_launch ?? (term as any).showInTitleLaunch ?? false
                      });
                      setShowTermModal(true);
                    }} className="p-2.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white"><Edit2 size={16} /></button>
                    <button onClick={() => {
                      setAuthRequestData({
                        key: 'EXCLUIR_PRAZO_COMERCIAL',
                        label: `OP: EXCLUSÃO DE PRAZO | ID: #${term.id.slice(-5)} | CTX: FINANCEIRO ESTRUTURAL | DET: Desativação permanente do prazo comercial ${term.name}. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${term.id}`
                      });
                      setIsRequestAuthModalOpen(true);
                    }} className="p-2.5 bg-brand-error/10 text-brand-error rounded-lg hover:bg-brand-error/20"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO: CATEGORIAS FINANCEIRAS (RESTAURADA) */}
      {(mode === 'full' || mode === 'categories_only') && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 mx-1">
            <div className="flex items-center gap-3">
              <Tag className="text-blue-400" size={20} />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Categorias e Fluxos</h3>
            </div>
            <button onClick={() => {
              setEditingCategoryId(null);
              setCategoryFormData({ name: '', type: 'both', showInSales: true, showInPurchases: true, showInLiquidation: true, show_in_bank_manual: true, show_in_pdv_manual: true });
              setShowCategoryModal(true);
            }} className="bg-blue-600 text-white py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all hover:bg-blue-500 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
              <Plus size={18} />
              <span>Nova Categoria</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mx-1">
            {financeCategories.map(cat => (
              <div key={cat.id} className="enterprise-card p-6 border-slate-800 flex justify-between items-center group bg-slate-900/30 hover:border-blue-500 transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-200 uppercase tracking-tight">{cat.name}</p>
                    {(cat.isDefault || cat.is_default) && <span className="text-[8px] text-blue-400 font-black uppercase bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">SISTEMA</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {cat.type === 'in' ? <ArrowUpCircle size={10} className="text-brand-success" /> : cat.type === 'out' ? <ArrowDownCircle size={10} className="text-brand-error" /> : <Activity size={10} className="text-blue-400" />}
                    <p className="text-[10px] text-slate-500 uppercase font-bold">{cat.type === 'in' ? 'APENAS ENTRADAS' : cat.type === 'out' ? 'APENAS SAÍDAS' : 'AMBOS OS FLUXOS'}</p>
                  </div>
                </div>
                {!(cat.isDefault || cat.is_default) && (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingCategoryId(cat.id);
                      setCategoryFormData({
                        name: cat.name,
                        type: cat.type as any,
                        showInSales: cat.show_in_sales ?? (cat as any).showInSales ?? true,
                        showInPurchases: cat.show_in_purchases ?? (cat as any).showInPurchases ?? true,
                        showInLiquidation: cat.show_in_liquidation ?? (cat as any).showInLiquidation ?? true,
                        show_in_bank_manual: cat.show_in_bank_manual ?? (cat as any).showInBankManual ?? true,
                        show_in_pdv_manual: cat.show_in_pdv_manual ?? (cat as any).showInPdvManual ?? true,
                        show_in_title_launch: cat.show_in_title_launch ?? (cat as any).showInTitleLaunch ?? true
                      });
                      setShowCategoryModal(true);
                    }} className="p-2.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white"><Edit2 size={16} /></button>
                    <button onClick={() => {
                      setAuthRequestData({
                        key: 'EXCLUIR_CATEGORIA_FINANCEIRA',
                        label: `OP: EXCLUSÃO DE CATEGORIA | ID: #${cat.id.slice(-5)} | CTX: PLANO DE CONTAS | DET: Remoção definitiva da categoria ${cat.name}. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${cat.id}`
                      });
                      setIsRequestAuthModalOpen(true);
                    }} className="p-2.5 bg-brand-error/10 text-brand-error rounded-lg hover:bg-brand-error/20"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: FORMULÁRIO DE PRAZO */}
      {showTermModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-xl overflow-hidden shadow-2xl border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
              <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest"><CreditCard className="text-brand-success" size={24} /> {editingId ? 'Editar Prazo' : 'Novo Prazo'}</h2>
              <button onClick={() => setShowTermModal(false)} className="p-2 text-slate-500 hover:text-white"><X size={32} /></button>
            </div>
            <form onSubmit={handleSaveTerm} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome da Condição</label>
                <input required className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-brand-success" value={termFormData.name} onChange={e => setTermFormData({ ...termFormData, name: e.target.value.toUpperCase() })} placeholder="EX: BOLETO 30 DIAS" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dias p/ Vencimento</label>
                  <input type="number" required className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-brand-success" value={termFormData.days} onChange={e => setTermFormData({ ...termFormData, days: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Parcelas</label>
                  <input type="number" required className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-brand-success" value={termFormData.installments} onChange={e => setTermFormData({ ...termFormData, installments: parseInt(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 pb-2">Contextos de Uso (Ativar nos módulos)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'show_in_sale', label: 'Vendas' }, { key: 'show_in_purchase', label: 'Compras' },
                    { key: 'show_in_settle', label: 'Baixas Financeiras' }, { key: 'show_in_bank_manual', label: 'Extrato Bancário' },
                    { key: 'show_in_pdv_manual', label: 'Manual PDV' }, { key: 'show_in_cashier_close', label: 'Fechar Caixa' },
                    { key: 'show_in_opening', label: 'Abertura Caixa' }, { key: 'show_in_title_launch', label: 'Lançar Título' }
                  ].map(ctx => (
                    <label key={ctx.key} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-all">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-brand-success"
                        checked={(termFormData as any)[ctx.key]}
                        onChange={e => {
                          const isChecked = e.target.checked;
                          if (ctx.key === 'show_in_pdv_manual') {
                            setTermFormData({ ...termFormData, show_in_pdv_manual: isChecked, show_in_manual_pdv: isChecked });
                          } else {
                            setTermFormData({ ...termFormData, [ctx.key]: isChecked });
                          }
                        }}
                      />
                      <span className="text-[9px] font-black uppercase text-slate-400">{ctx.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                {editingId ? 'SOLICITAR LIBERAÇÃO EDIÇÃO' : 'SALVAR REGISTRO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FORMULÁRIO DE CATEGORIA */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-xl overflow-hidden shadow-2xl border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
              <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest"><Tag className="text-blue-400" size={24} /> {editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-2 text-slate-500 hover:text-white transition-all"><X size={32} /></button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome da Categoria</label>
                <input required className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-500" value={categoryFormData.name} onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value.toUpperCase() })} placeholder="EX: ALUGUEL, FRETE, ENERGIA" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo de Movimentação</label>
                <select className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-blue-500" value={categoryFormData.type} onChange={e => setCategoryFormData({ ...categoryFormData, type: e.target.value as any })}>
                  <option value="both">ENTRADAS E SAÍDAS</option>
                  <option value="in">APENAS ENTRADAS (+)</option>
                  <option value="out">APENAS SAÍDAS (-)</option>
                </select>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Habilitar Contextos</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { key: 'showInSales', label: 'Vendas' }, { key: 'showInPurchases', label: 'Compras' }, { key: 'showInLiquidation', label: 'Liquidações' }
                  ].map(ctx => (
                    <label key={ctx.key} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-all">
                      <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={(categoryFormData as any)[ctx.key]} onChange={e => setCategoryFormData({ ...categoryFormData, [ctx.key]: e.target.checked })} />
                      <span className="text-[9px] font-black uppercase text-slate-400">{ctx.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <p className="text-[10px] font-black text-brand-warning uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                  <ShieldAlert size={12} /> Classificação de Lançamento Manual
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-all">
                    <input type="checkbox" className="w-4 h-4 accent-brand-warning" checked={categoryFormData.show_in_bank_manual} onChange={e => setCategoryFormData({ ...categoryFormData, show_in_bank_manual: e.target.checked })} />
                    <span className="text-[9px] font-black uppercase text-slate-400">FINANCEIRO (BANCO)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-all">
                    <input type="checkbox" className="w-4 h-4 accent-brand-warning" checked={categoryFormData.show_in_pdv_manual} onChange={e => setCategoryFormData({ ...categoryFormData, show_in_pdv_manual: e.target.checked })} />
                    <span className="text-[9px] font-black uppercase text-slate-400">TERMINAL PDV</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-all">
                    <input type="checkbox" className="w-4 h-4 accent-brand-warning" checked={(categoryFormData as any).show_in_title_launch} onChange={e => setCategoryFormData({ ...categoryFormData, show_in_title_launch: e.target.checked })} />
                    <span className="text-[9px] font-black uppercase text-slate-400">LANÇAR TÍTULO (MANUAL)</span>
                  </label>
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                {editingCategoryId ? 'SOLICITAR LIBERAÇÃO EDIÇÃO' : 'SALVAR REGISTRO'}
              </button>
            </form>
          </div>
        </div>
      )}

      <RequestAuthorizationModal isOpen={isRequestAuthModalOpen} onClose={() => setIsRequestAuthModalOpen(false)} actionKey={authRequestData?.key || ''} actionLabel={authRequestData?.label || ''} />
    </div>
  );
};

export default Finance;