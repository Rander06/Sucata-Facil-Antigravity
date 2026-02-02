// @google/genai Senior Frontend Engineer: Standardizing narratives and approval labels.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { db as dbService } from '../services/dbService';
import { Material, Partner, Transaction, FinancialRecord, PermissionModule, CashierSession, PaymentTerm, FinanceCategory, User, WalletTransaction, Bank, AuthorizationRequest, UserRole, OperationalProfile } from '../types';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import { authorizationService } from '../services/authorizationService';
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  Package,
  Clock,
  Edit,
  Eye,
  Lock,
  Unlock,
  AlertCircle,
  AlertTriangle,
  X,
  Wallet,
  Calculator,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Receipt,
  FileText,
  Calendar,
  Zap,
  ChevronDown,
  User as UserIcon,
  Check,
  History as HistoryIcon,
  Scale,
  MinusCircle,
  PlusCircle,
  Edit2,
  RotateCcw,
  CreditCard,
  ChevronRight,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Building,
  Settings2,
  Loader2,
  Smartphone,
  Banknote as CashIcon,
  Save,
  ShieldAlert,
  Landmark
} from 'lucide-react';

const db = dbService;

interface CartItem {
  id: string;
  material: Material;
  quantity: number;
  unit: 'KG' | 'UN';
  systemPrice: number;
  appliedPrice: number;
}

const POS: React.FC = () => {
  const { currentUser, currentCompany, pendingRequests, refreshRequests, refreshData } = useAppContext();
  const companyId = currentUser?.companyId || currentUser?.company_id || null;

  // @google/genai Senior Frontend Engineer: Trava de segurança para impedir re-processamento por polling de 2s
  const processedIdsRef = useRef<Set<string>>(new Set());

  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [allSessions, setAllSessions] = useState<CashierSession[]>([]);

  const [allTerms, setAllTerms] = useState<PaymentTerm[]>([]);
  const [purchasePaymentTerms, setPurchasePaymentTerms] = useState<PaymentTerm[]>([]);
  const [salePaymentTerms, setSalePaymentTerms] = useState<PaymentTerm[]>([]);
  const [openingTerms, setOpeningTerms] = useState<PaymentTerm[]>([]);

  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>(() => {
    const isSuperUser = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.profile === OperationalProfile.MASTER;
    if (isSuperUser) return 'sell'; // Default to sell for admins
    if (currentUser?.permissions.includes(PermissionModule.PURCHASES_VIEW)) return 'buy';
    if (currentUser?.permissions.includes(PermissionModule.SALES_VIEW)) return 'sell';
    return 'buy'; // Fallback
  });

  // ... (Lines 93-870 remain unchanged in context, but we are replacing the state init line 91)
  // Wait, I strictly cannot easily replace line 91 and 870 in one go if they are far apart.
  // I will split this into two calls or use multi-replace if supported.
  // The tool description says: "Use this tool ONLY when you are making a SINGLE CONTIGUOUS block of edits".
  // So I must use multi_replace_file_content if I want to edit line 91 and 871.
  // Converting this call to multi_replace...

  const [search, setSearchTerm] = useState('');

  const [activeSession, setActiveSession] = useState<CashierSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPartnerMenuOpen, setIsPartnerMenuOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');

  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [openingBankId, setOpeningBankId] = useState('');
  const [openingTermId, setOpeningTermId] = useState('');

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingBreakdown, setClosingBreakdown] = useState<Record<string, string>>({});
  const [showClosingPrintPreview, setShowClosingPrintPreview] = useState(false);
  const [lastClosedSession, setLastClosedSession] = useState<{ session: CashierSession, records: FinancialRecord[] } | null>(null);

  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [manualEntryForm, setManualEntryForm] = useState({
    tipo: 'saída' as 'entrada' | 'saída',
    valor: '',
    categoria: '',
    descricao: '',
    paymentTermId: ''
  });

  const [viewingTransactionForPrint, setViewingTransactionForPrint] = useState<Transaction | null>(null);

  const [paymentDefModal, setPaymentDefModal] = useState<{
    show: boolean;
    record: FinancialRecord | null;
    termId: string;
    dueDate: string;
    receivedValue: string;
  }>({ show: false, record: null, termId: '', dueDate: '', receivedValue: '' });

  const [warningPopup, setWarningPopup] = useState<{ title: string, message: string } | null>(null);
  const [operationalTime, setOperationalTime] = useState('');
  const closingFormRef = useRef<HTMLFormElement>(null);

  const handleClosingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = closingFormRef.current;
      if (!form) return;

      const index = Array.from(form.elements).indexOf(e.currentTarget as any);
      if (index > -1) {
        const nextElement = form.elements[index + 1] as HTMLElement;
        if (nextElement && (nextElement.tagName === 'INPUT' || nextElement.tagName === 'BUTTON')) {
          nextElement.focus();
        } else {
          handleFinalClose(e as any);
        }
      }
    }
  };

  useEffect(() => {
    if (!activeSession?.openingTime) {
      setOperationalTime('');
      return;
    }
    const updateTime = () => {
      const open = new Date(activeSession.openingTime!);
      const now = new Date();
      const diff = Math.floor((now.getTime() - open.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setOperationalTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [activeSession?.openingTime]);

  const parseNumericString = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/[^\d.,]/g, '');
    if (clean.includes(',')) {
      const normalized = clean.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    }
    const parts = clean.split('.');
    if (parts.length > 2) {
      return parseFloat(clean.replace(/\./g, '')) || 0;
    }
    return parseFloat(clean) || 0;
  };

  const [isRequestAuthModalOpen, setIsRequestAuthModalOpen] = useState(false);
  const [isRequestDeleteAuthModalOpen, setIsRequestDeleteAuthModalOpen] = useState(false);
  const [isRequestCloseAuthModalOpen, setIsRequestCloseAuthModalOpen] = useState(false);
  const [isRequestManualAuthModalOpen, setIsRequestManualAuthModalOpen] = useState(false);
  const [isRequestEditRecordAuthModalOpen, setIsRequestEditRecordAuthModalOpen] = useState(false);
  const [isRequestEditOpeningAuthModalOpen, setIsRequestEditOpeningAuthModalOpen] = useState(false);
  const [isRequestEditPosTxAuthModalOpen, setIsRequestEditPosTxAuthModalOpen] = useState(false);

  const [pendingVoidRecordId, setPendingVoidRecordId] = useState<string | null>(null);
  const [pendingDeleteRecordId, setPendingDeleteRecordId] = useState<string | null>(null);
  const [pendingCloseSessionId, setPendingCloseSessionId] = useState<string | null>(null);
  const [manualEntryToRequest, setManualEntryToRequest] = useState<any>(null);
  const [editRecordToRequest, setEditRecordToRequest] = useState<any>(null);
  const [editOpeningToRequest, setEditOpeningToRequest] = useState<any>(null);
  const [editPosTxToRequest, setEditPosTxToRequest] = useState<any>(null);

  const isClosePending = useMemo(() => {
    if (!activeSession) return false;
    return pendingRequests.some(r =>
      r.action_key === 'FECHAR_CAIXA' &&
      r.status === 'PENDING' &&
      r.action_label.includes(activeSession.id.toUpperCase().slice(-5))
    );
  }, [pendingRequests, activeSession]);

  const dynamicClosingItems = useMemo(() => {
    if (!activeSession) return [];
    const items: { id: string, label: string, group: 'ENTRADA' | 'SAIDA' | 'FISICO' | 'ENTRADA_INFO' | 'SAIDA_INFO' }[] = [];

    // GRUPO FISICO (Mantém inalterado - sempre presente)
    items.push({ id: 'physical_cash', label: 'DINHEIRO EM MÃOS', group: 'FISICO' });
    items.push({ id: 'physical_check', label: 'CHEQUE EM MÃOS', group: 'FISICO' });

    // Buscar todos os registros financeiros deste turno
    const shiftRecords = db.queryTenant<FinancialRecord>('financials', companyId, f => f.caixa_id === activeSession.id);

    // Categorias excluídas
    const excludedCategories = ['Compra de Materiais', 'Venda de Materiais'];

    // Processar categorias únicas por natureza
    const categoryMap = new Map<string, { natureza: string, total: number }>();

    shiftRecords.forEach(rec => {
      // Validações de segurança
      if (!rec.categoria || !rec.natureza) return;
      if (excludedCategories.includes(rec.categoria)) return;

      const key = `cat_${rec.categoria}_${rec.natureza}`;
      const existing = categoryMap.get(key);
      if (existing) {
        existing.total += rec.valor;
      } else {
        categoryMap.set(key, { natureza: rec.natureza, total: rec.valor });
      }
    });

    // Processar payment terms únicos por natureza
    const termMap = new Map<string, { natureza: string, total: number }>();

    shiftRecords.forEach(rec => {
      // Pular se não tem payment_term_id
      if (!rec.payment_term_id && !rec.paymentTermId) return;

      const termId = rec.payment_term_id || rec.paymentTermId;
      const term = allTerms && allTerms.length > 0 ? allTerms.find(t => t.id === termId || t.uuid === termId) : null;

      if (!term) return;

      // Excluir À VISTA (DINHEIRO)
      if (term.name === 'À VISTA (DINHEIRO)' || term.name === 'À VISTA') return;

      // Validação de segurança para natureza
      if (!rec.natureza) return;

      const key = `term_${term.name}_${rec.natureza}`;
      const existing = termMap.get(key);
      if (existing) {
        existing.total += rec.valor;
      } else {
        termMap.set(key, { natureza: rec.natureza, total: rec.valor });
      }
    });

    // Adicionar categorias ao array de items
    categoryMap.forEach((value, key) => {
      const categoria = key.replace(`cat_`, '').replace(`_${value.natureza}`, '');
      items.push({
        id: key,
        label: categoria.toUpperCase(),
        group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO'
      });
    });

    // Adicionar payment terms ao array de items
    termMap.forEach((value, key) => {
      const termName = key.replace(`term_`, '').replace(`_${value.natureza}`, '');
      items.push({
        id: key,
        label: `${termName.toUpperCase()}`,
        group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO'
      });
    });

    return items;
  }, [activeSession, companyId, allTerms, refreshKey]);

  const getStatusInfo = (record: FinancialRecord) => {
    const isCanceled = record.status === 'reversed' || record.is_reversed || record.isReversed;
    const isPaid = !!record.liquidation_date || record.status === 'paid';
    const dueDate = record.dueDate || record.due_date;
    const today = db.getToday();

    if (isCanceled) return { label: 'CANCELADO', color: 'bg-slate-800 text-slate-500 border-slate-700', isStriked: true };
    if (isPaid) return { label: 'LIQUIDADO', color: 'bg-brand-success/10 text-brand-success border-brand-success/20', isStriked: false };
    if (!dueDate) return { label: 'PENDENTE', color: 'bg-brand-warning/10 text-brand-warning border-brand-warning/20', isStriked: false };
    if (dueDate < today) return { label: 'ATRASADO', color: 'bg-brand-error/10 text-brand-error border-brand-error/20', isStriked: false };
    return { label: 'ABERTO', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', isStriked: false };
  };

  // Polling for Auto-Refresh (10s)
  useEffect(() => {
    const interval = setInterval(() => {
      triggerRefresh();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const historyRecords = useMemo(() => {
    if (!activeSession) return [];

    const financials = db.queryTenant<FinancialRecord>('financials', companyId, f => {
      // 1. Belong to this session (Standard)
      if (f.caixa_id === activeSession.id) return true;

      // 2. Belong to this User + Timeframe (Even if moved to Finance Session)
      // Checks if created by this user AFTER the session opened
      if ((f.user_id === activeSession.userId || f.user_id === (activeSession as any).user_id) &&
        f.created_at >= activeSession.openingTime!) {
        return true;
      }
      return false;
    });

    return financials.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activeSession, companyId, refreshKey]);

  const executeManualEntryAction = useCallback(async (tipo: 'entrada' | 'saída', valor: string, categoria: string, descricao: string, paymentTermId: string, authId: string, authName: string) => {
    if (!activeSession) return;
    const valorNum = parseNumericString(valor);
    const isEntry = tipo === 'entrada';
    const now = db.getNowISO();

    const allTermsData = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);
    const term = allTermsData.find(t => t.id === paymentTermId || t.uuid === paymentTermId);
    const days = term?.days || 0;
    const calcDate = new Date();
    calcDate.setDate(calcDate.getDate() + days);
    const dueDate = calcDate.toISOString().split('T')[0];

    await db.insert<FinancialRecord>('financials', {
      companyId, tipo: isEntry ? 'suprimento' : 'sangria', categoria, valor: valorNum, description: `PDV [${tipo.toUpperCase()}]: ${descricao || 'LANÇAMENTO MANUAL'}`,
      dueDate: dueDate, status: 'paid', caixa_id: activeSession.id, user_id: activeSession.userId || (activeSession as any).user_id, created_at: now, paymentTermId: paymentTermId, natureza: isEntry ? 'ENTRADA' : 'SAIDA', liquidation_date: now
    });
    triggerRefresh();
  }, [activeSession, companyId]);

  const executeTransactionVoid = useCallback(async (recordId: string) => {
    const record = db.query<FinancialRecord>('financials', r => r.id === recordId)[0];
    if (!record) return;
    try {
      if (record.transaction_id) await db.update('transactions', record.transaction_id, { status: 'completed' });
      await db.update('financials', record.id, { status: 'pending', liquidation_date: null, dueDate: null, due_date: null, is_reversed: false, payment_term_id: null, paymentTermId: null });
      triggerRefresh();
    } catch (err: any) { console.error(err); }
  }, [companyId]);

  const executeRecordCancel = useCallback(async (recordId: string) => {
    const record = db.query<FinancialRecord>('financials', r => r.id === recordId)[0];
    if (!record) return;
    try {
      if (record.transaction_id && record.status !== 'reversed' && !record.is_reversed) {
        const tx = db.query<Transaction>('transactions', t => t.id === record.transaction_id)[0];
        if (tx && tx.status !== 'canceled') {
          for (const item of tx.items) {
            const mat = db.query<Material>('materials', m => m.id === item.materialId)[0];
            if (mat) {
              const revStock = tx.natureza === 'SAIDA' ? (mat.stock - item.quantity) : (mat.stock + item.quantity); // Ajustado para natureza
              await db.update('materials', mat.id, { stock: revStock });
            }
          }
          await db.update('transactions', tx.id, { status: 'canceled' });
        }
      }
      await db.update('financials', record.id, { status: 'reversed', is_reversed: true, liquidation_date: null, dueDate: null, due_date: null });
      triggerRefresh();
    } catch (err: any) { console.error(err); }
  }, [companyId]);

  const executeEditRecord = useCallback(async (recordId: string, data: any, authId: string, authName: string) => {
    const valorNum = typeof data.valor === 'string' ? parseNumericString(data.valor) : data.valor;
    const isEntry = data.tipo === 'entrada';
    await db.update('financials', recordId, { natureza: isEntry ? 'ENTRADA' : 'SAIDA', tipo: isEntry ? 'suprimento' : 'sangria', categoria: data.categoria, description: data.descricao.toUpperCase(), valor: valorNum, paymentTermId: data.paymentTermId });
    triggerRefresh();
  }, [companyId]);

  const executeEditOpening = useCallback(async (recordId: string, value: string, authId: string, authName: string) => {
    if (!activeSession) return;
    const valorNum = parseNumericString(value);
    await db.update('financials', recordId, { valor: valorNum });
    await db.update('cashierSessions', activeSession.id, { openingBalance: valorNum });
    triggerRefresh();
  }, [activeSession, companyId]);

  const executeEditPosTx = useCallback(async (recordId: string, extraData: any, authId: string, authName: string) => {
    const { cartItems, partnerId, transactionType, originalTransactionId } = extraData;
    const total = cartItems.reduce((sum: number, i: any) => sum + (i.quantity * i.appliedPrice), 0);
    const originalTx = db.queryTenant<Transaction>('transactions', companyId).find(t => t.id === originalTransactionId);
    if (originalTx) {
      for (const oldItem of originalTx.items) {
        const mat = materials.find(m => m.id === oldItem.materialId);
        if (mat) {
          const revStock = originalTx.natureza === 'SAIDA' ? (mat.stock - oldItem.quantity) : (mat.stock + oldItem.quantity);
          await db.update('materials', mat.id, { stock: revStock });
        }
      }
    }
    const mappedItems = cartItems.map((item: any) => ({
      id: item.id || Math.random().toString(36).substring(7), materialId: item.material.id, materialName: item.material.name,
      quantity: item.quantity, price: item.appliedPrice, total: item.quantity * item.appliedPrice, unit: item.unit
    }));
    await db.update('transactions', originalTransactionId, { valor: total, items: mappedItems, status: 'completed', natureza: transactionType === 'buy' ? 'SAIDA' : 'ENTRADA' });
    for (const item of cartItems) {
      const mat = materials.find(m => m.id === item.material.id);
      if (mat) {
        const newStock = transactionType === 'buy' ? (item.material.stock + item.quantity) : (item.material.stock - item.quantity);
        await db.update('materials', mat.id, { stock: newStock });
      }
    }
    await db.update('financials', recordId, { valor: total, parceiro_id: partnerId, tipo: transactionType === 'buy' ? 'compras' : 'vendas', categoria: transactionType === 'buy' ? 'Compra de Materiais' : 'Venda de Materiais', natureza: transactionType === 'buy' ? 'SAIDA' : 'ENTRADA' });
    triggerRefresh();
  }, [companyId, materials]);

  useEffect(() => {
    if (!currentUser) return;

    // Filtramos apenas aprovações que ainda não processamos localmente nesta sessão
    const approvedToProcess = pendingRequests.filter(r =>
      r.status === 'APPROVED' &&
      r.requested_by_id === currentUser.id &&
      !processedIdsRef.current.has(r.id)
    );

    if (approvedToProcess.length > 0) {
      const processAll = async () => {
        let needsLocalRefresh = false;
        for (const req of approvedToProcess) {
          try {
            // Marco o ID imediatamente como processado para evitar que o próximo polling (2s) repita a ação
            processedIdsRef.current.add(req.id);

            if (req.action_key === 'ESTORNAR_LANCAMENTO') {
              const recordId = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              if (recordId) { await executeTransactionVoid(recordId); needsLocalRefresh = true; }
            }
            else if (req.action_key === 'CANCELAR_LANCAMENTO') {
              const recordId = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              if (recordId) { await executeRecordCancel(recordId); needsLocalRefresh = true; }
            }
            else if (req.action_key === 'FECHAR_CAIXA') {
              const initial: Record<string, string> = {};
              dynamicClosingItems.forEach(i => initial[i.id] = '');
              setClosingBreakdown(initial);
              setIsClosingModalOpen(true);
              setPendingCloseSessionId(null);
            }
            else if (req.action_key === 'LANCAMENTO_MANUAL') {
              const label = req.action_label;
              const isEntry = label.toUpperCase().includes('TIPO: ENTRADA');
              const tipo = isEntry ? 'entrada' : 'saída';

              let valorExtraido = '0';
              try { const parts = label.split('VAL: R$ 0,00 para R$ '); if (parts.length > 1) valorExtraido = parts[1].split(' |')[0].trim(); } catch (e) { }
              let categoriaExtraida = '';
              try { const parts = label.split('CAT: '); if (parts.length > 1) categoriaExtraida = parts[1].split(' |')[0].trim(); } catch (e) { }
              let descricaoExtraida = '';
              try { const parts = label.split('DESC: '); if (parts.length > 1) descricaoExtraida = parts[1].split(' |')[0].trim(); } catch (e) { }
              let termIdExtraido = '';
              try { const parts = label.split('TERM_ID: '); if (parts.length > 1) termIdExtraido = parts[1].split(' |')[0].trim(); } catch (e) { }

              await executeManualEntryAction(tipo as any, valorExtraido, categoriaExtraida, descricaoExtraida, termIdExtraido, req.responded_by_id!, req.responded_by_name!);
              needsLocalRefresh = true;
            }
            else if (req.action_key === 'EDITAR_LANCAMENTO') {
              const recordId = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              const dataRaw = req.action_label.split('JSON: ')[1]?.trim();
              if (recordId && dataRaw) {
                await executeEditRecord(recordId, JSON.parse(dataRaw), req.responded_by_id!, req.responded_by_name!);
                needsLocalRefresh = true;
              }
            }
            else if (req.action_key === 'AJUSTAR_ABERTURA') {
              const recordId = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              const newValue = req.action_label.split('para R$ ')[1]?.split(' |')[0]?.trim();
              if (recordId && newValue) {
                await executeEditOpening(recordId, newValue, req.responded_by_id!, req.responded_by_name!);
                setIsOpeningModalOpen(false);
                needsLocalRefresh = true;
              }
            }
            else if (req.action_key === 'EDITAR_OPERACAO_PDV') {
              const recordId = req.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
              const extraDataRaw = req.action_label.split('JSON: ')[1]?.trim();
              if (recordId && extraDataRaw) {
                await executeEditPosTx(recordId, JSON.parse(extraDataRaw), req.responded_by_id!, req.responded_by_name!);
                setCart([]); setSelectedPartnerId(''); setEditingRecordId(null);
                needsLocalRefresh = true;
              }
            }

            await db.update('authorization_requests' as any, req.id, { status: 'PROCESSED' } as any);
          } catch (e) {
            console.error("Falha ao processar liberação no PDV:", e);
          }
        }

        if (needsLocalRefresh) {
          triggerRefresh();
          refreshData();
          refreshRequests();
        }
      };

      processAll();
    }
  }, [pendingRequests, currentUser, activeSession, dynamicClosingItems, historyRecords, executeTransactionVoid, executeRecordCancel, executeManualEntryAction, executeEditRecord, executeEditOpening, executeEditPosTx, refreshData, refreshRequests]);

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    const client = db.getCloudClient();

    try {
      let allBanks: Bank[] = [];
      let allTermsData: PaymentTerm[] = [];
      let allCats: FinanceCategory[] = [];
      let allMats: Material[] = [];
      let allParts: Partner[] = [];
      let allSessionsData: CashierSession[] = [];

      if (client && companyId) {
        const fetchTable = async (table: string, filters: any = {}) => {
          try {
            let query = client.from(table).select('*');
            if (filters.eq) query = query.eq(filters.eq[0], filters.eq[1]);
            if (filters.or) query = query.or(filters.or);
            const { data, error } = await query;
            if (error) return null;
            return data;
          } catch (e) {
            return null;
          }
        };

        const [bData, tData, cData, mData, pData, sData] = await Promise.all([
          fetchTable('banks', { eq: ['company_id', companyId] }),
          fetchTable('payment_terms', { or: `company_id.eq.${companyId},company_id.is.null` }),
          fetchTable('finance_categories', { or: `company_id.eq.${companyId},company_id.is.null` }),
          fetchTable('materials', { eq: ['company_id', companyId] }),
          fetchTable('partners', { eq: ['company_id', companyId] }),
          fetchTable('cashier_sessions', { eq: ['company_id', companyId] })
        ]);

        allBanks = bData ? bData.map(db.normalize) : db.queryTenant<Bank>('banks', companyId);
        allTermsData = tData ? tData.map(db.normalize) : db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);
        allCats = cData ? cData.map(db.normalize) : db.queryTenant<FinanceCategory>('financeCategories', companyId);
        allMats = mData ? mData.map(db.normalize) : db.queryTenant<Material>('materials', companyId);
        allParts = pData ? pData.map(db.normalize) : db.queryTenant<Partner>('partners', companyId);
        allSessionsData = sData ? (sData as any[]).map(db.normalize) : db.queryTenant<CashierSession>('cashierSessions', companyId);
      } else {
        allBanks = db.queryTenant<Bank>('banks', companyId);
        allTermsData = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);
        allCats = db.queryTenant<FinanceCategory>('financeCategories', companyId);
        allMats = db.queryTenant<Material>('materials', companyId);
        allParts = db.queryTenant<Partner>('partners', companyId);
        allSessionsData = db.queryTenant<CashierSession>('cashierSessions', companyId);
      }

      const pTerms = allTermsData.filter(t => t.show_in_purchase === true || (t as any).showInPurchase === true);
      const sTerms = allTermsData.filter(t => t.show_in_sale === true || (t as any).showInSale === true);
      const oTerms = allTermsData.filter(t => t.show_in_opening === true || (t as any).showInOpening === true);

      setMaterials(allMats);
      setPartners(allParts);
      setBanks(allBanks);
      setAllTerms(allTermsData);
      setPurchasePaymentTerms(pTerms);
      setSalePaymentTerms(sTerms);
      setOpeningTerms(oTerms);
      setFinanceCategories(allCats);
      setAllSessions(allSessionsData);
    } catch (err) {
      console.error("Error syncing data:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [companyId, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const partnerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (partnerMenuRef.current && !partnerMenuRef.current.contains(event.target as Node)) setIsPartnerMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkCashierStatus = useCallback(() => {
    if (!currentUser) return;
    const sessions = db.queryTenant<CashierSession>('cashierSessions', companyId, s => (s.userId === currentUser.id || s.user_id === currentUser.id) && s.status === 'open' && s.type === 'pos');
    setActiveSession(sessions[0] || null);
  }, [companyId, currentUser, refreshKey]);

  useEffect(() => { checkCashierStatus(); }, [checkCashierStatus]);

  const sortedPartners = useMemo(() => {
    return [...partners].filter(p => {
      if (type === 'buy') return p.type === 'supplier' || p.type === 'both';
      if (type === 'sell') return p.type === 'customer' || p.type === 'both';
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name)).filter(p => p.name.toLowerCase().includes(partnerSearch.toLowerCase()) || p.document.includes(partnerSearch));
  }, [partners, partnerSearch, type]);

  const selectedPartner = useMemo(() => partners.find(p => p.id === selectedPartnerId), [partners, selectedPartnerId]);

  const categoriesManual = useMemo(() => {
    const flowType = manualEntryForm.tipo === 'entrada' ? 'in' : 'out';
    return financeCategories.filter(c => {
      const isMarkedForPdv = c.show_in_pdv_manual === true || (c as any).showInPdvManual === true;
      if (!isMarkedForPdv) return false;
      return c.type === 'both' || c.type === flowType;
    });
  }, [financeCategories, manualEntryForm.tipo]);

  const filteredManualPdvTerms = useMemo(() => {
    return allTerms.filter(t =>
      t.show_in_pdv_manual === true ||
      (t as any).showInPdvManual === true
    );
  }, [allTerms]);

  const handleOpenCashierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpening) return;
    if (editingRecordId) { setEditOpeningToRequest({ recordId: editingRecordId, value: openingBalanceInput }); setIsRequestEditOpeningAuthModalOpen(true); return; }

    if (!openingBankId) return alert("Selecione o Banco de Origem para o fundo de troco.");
    if (!openingTermId) return alert("Selecione o Meio de Pagamento.");

    const valorNum = parseNumericString(openingBalanceInput);
    setIsOpening(true);
    try {
      const now = db.getNowISO();
      const bank = banks.find(b => b.id === openingBankId);
      const term = openingTerms.find(t => t.id === openingTermId || t.uuid === openingTermId);

      const session = await db.insert<CashierSession>('cashierSessions', {
        companyId,
        userId: currentUser!.id,
        user_id: currentUser!.id,
        userName: currentUser!.name,
        user_name: currentUser!.name,
        type: 'pos',
        status: 'open',
        openingBalance: valorNum,
        openingTime: now
      });

      await db.insert<FinancialRecord>('financials', {
        companyId,
        tipo: 'entrada',
        categoria: 'Abertura de Caixa',
        valor: valorNum,
        status: 'paid',
        description: `ABERTURA DE CAIXA - TURNO ${session.id.slice(0, 6).toUpperCase()}`,
        dueDate: db.getToday(),
        caixa_id: session.id,
        user_id: currentUser!.id,
        created_at: now,
        paymentTermId: openingTermId,
        natureza: 'ENTRADA',
        liquidation_date: now
      });

      const walletTxs = db.queryTenant<WalletTransaction>('walletTransactions' as any, companyId);
      const sortedWallet = [...walletTxs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastBalance = walletTxs.length > 0 ? sortedWallet[0].saldo_real : 0;

      await db.insert<WalletTransaction>('walletTransactions' as any, {
        company_id: companyId!,
        user_id: currentUser!.id,
        categoria: 'ABERTURA DE CAIXA',
        parceiro: bank?.name || 'BANCO ORIGEM',
        payment_term_id: openingTermId,
        forma: term?.name || 'OUTROS',
        descricao: `SAÍDA DE CONTA PARA FUNDO DE TROCO - TURNO ${session.id.slice(0, 6).toUpperCase()}`,
        valor_entrada: 0,
        valor_saida: valorNum,
        saldo_real: lastBalance - valorNum,
        created_at: now
      });

      setActiveSession(session);
      setIsOpeningModalOpen(false);
      setOpeningBalanceInput('');
      setOpeningBankId('');
      setOpeningTermId('');
      triggerRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsOpening(false);
    }
  };

  const handleTryClose = () => {
    if (!activeSession) return;
    const pendingCount = historyRecords.filter(r => getStatusInfo(r).label === 'PENDENTE').length;
    if (pendingCount > 0) { setWarningPopup({ title: "Encerramento Impedido", message: `Existem ${pendingCount} pedidos com status PENDENTE no histórico deste turno. Você deve Finalizar a Operação de todos os itens antes de solicitar o fechamento.` }); return; }
    setPendingCloseSessionId(activeSession.id); setIsRequestCloseAuthModalOpen(true);
  };

  const handleFinalClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    try {
      const physical: Record<string, number> = {};
      dynamicClosingItems.forEach(item => { const valStr = closingBreakdown[item.id] || '0'; physical[item.id] = parseNumericString(valStr); });
      const totalFisicoEmMao = (physical['physical_cash'] || 0) + (physical['physical_check'] || 0);

      const expectedTotal = db.calculateExpectedValue(companyId, activeSession, 'vista', [], financeCategories, 'ENTRADA') +
        db.calculateExpectedValue(companyId, activeSession, 'cheque', [], financeCategories, 'ENTRADA');

      const records = db.queryTenant<FinancialRecord>('financials', companyId, f => f.caixa_id === activeSession.id);
      const closedSessionData = await db.update<CashierSession>('cashierSessions', activeSession.id, {
        status: 'closed',
        closingBalance: totalFisicoEmMao,
        expectedBalance: expectedTotal,
        difference: totalFisicoEmMao - expectedTotal,
        closingTime: db.getNowISO(),
        physicalBreakdown: physical as any
      });
      setLastClosedSession({ session: closedSessionData as any, records }); setActiveSession(null); setIsClosingModalOpen(false); setShowClosingPrintPreview(true); triggerRefresh();
    } catch (err: any) { alert(err.message); }
  };

  const handleConfirmPaymentDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !paymentDefModal.record || !paymentDefModal.termId) return;
    setIsSubmitting(true);
    try {
      const terms = [...purchasePaymentTerms, ...salePaymentTerms];
      const term = terms.find(t => t.id === paymentDefModal.termId || t.uuid === paymentDefModal.termId);
      const isImmediate = term && term.days === 0;

      await db.update('financials', paymentDefModal.record.id, { due_date: paymentDefModal.dueDate, payment_term_id: paymentDefModal.termId, status: isImmediate ? 'paid' : 'pending', liquidation_date: isImmediate ? db.getNowISO() : null });

      setPaymentDefModal({ show: false, record: null, termId: '', dueDate: '', receivedValue: '' }); triggerRefresh();
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const handleManualEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    if (!manualEntryForm.paymentTermId) { alert("Selecione a Forma de Pagamento."); return; }
    if (editingRecordId) { setEditRecordToRequest({ recordId: editingRecordId, data: manualEntryForm }); setIsRequestEditRecordAuthModalOpen(true); } else { setManualEntryToRequest(manualEntryForm); setIsRequestManualAuthModalOpen(true); }
    setIsManualEntryModalOpen(false);
  };

  const handleCheckout = async () => {
    if (isSubmitting || !activeSession || !currentUser || !selectedPartnerId || cart.length === 0) return;
    if (editingRecordId) {
      const financial = historyRecords.find(r => r.id === editingRecordId);
      if (financial?.transaction_id) {
        setEditPosTxToRequest({ recordId: editingRecordId, cartItems: cart, partnerId: selectedPartnerId, transactionType: type, originalTransactionId: financial.transaction_id });
        setIsRequestEditPosTxAuthModalOpen(true);
        return;
      }
    }
    const partner = partners.find(p => p.id === selectedPartnerId);
    if (partner) {
      if (type === 'buy' && partner.type === 'customer') return alert("Parceiros do tipo CLIENTE não podem fornecer.");
      if (type === 'sell' && partner.type === 'supplier') return alert("Parceiros do tipo FORNECEDOR não podem comprar.");
    }
    setIsSubmitting(true);
    try {
      const total = cart.reduce((sum, i) => sum + (i.quantity * i.appliedPrice), 0);
      const now = db.getNowISO();
      const tx = await db.insert<Transaction>('transactions', {
        company_id: companyId!,
        user_id: activeSession.userId || (activeSession as any).user_id,
        valor: total,
        status: 'completed',
        natureza: type === 'buy' ? 'SAIDA' : 'ENTRADA',
        tipo: type === 'buy' ? 'compras' : 'vendas',
        items: cart.map(i => ({
          id: Math.random().toString(36).substring(7),
          materialId: i.material.id,
          materialName: i.material.name,
          quantity: i.quantity,
          price: i.appliedPrice,
          total: i.quantity * i.appliedPrice,
          unit: i.unit
        })),
        created_at: now
      });
      for (const item of cart) {
        const mat = materials.find(m => m.id === item.material.id);
        if (mat) {
          const newStock = type === 'buy' ? (mat.stock + item.quantity) : (mat.stock - item.quantity);
          await db.update('materials', mat.id, { stock: newStock });
        }
      }
      await db.insert('financials', {
        companyId,
        tipo: type === 'buy' ? 'compras' : 'vendas',
        categoria: type === 'buy' ? 'Compra de Materiais' : 'Venda de Materiais',
        valor: total,
        description: `PDV: ${type === 'buy' ? 'Compra' : 'Venda'} #${tx.id.slice(0, 6).toUpperCase()}`,
        dueDate: null,
        status: 'pending',
        parceiro_id: selectedPartnerId,
        transaction_id: tx.id,
        caixa_id: activeSession.id,
        user_id: activeSession.userId || (activeSession as any).user_id,
        created_at: now,
        natureza: type === 'buy' ? 'SAIDA' : 'ENTRADA'
      });
      setCart([]); setSelectedPartnerId(''); triggerRefresh();
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const addToCart = (material: Material) => { if (!activeSession) return; const systemPrice = type === 'buy' ? (material.buyPrice || 0) : (material.sellPrice || 0); setCart(prev => [...prev, { id: Math.random().toString(36).substring(7), material, quantity: 1, unit: material.unit, systemPrice, appliedPrice: systemPrice }]); };

  const closingMetrics = useMemo(() => {
    if (!activeSession) return { expected: 0, totalFisico: 0, totalEntradasInfo: 0, totalSaidasInfo: 0 };

    const totalFisico = dynamicClosingItems
      .filter(i => i.group === 'FISICO')
      .reduce((sum, i) => sum + parseNumericString(closingBreakdown[i.id] || '0'), 0);

    const totalEntradasInfo = dynamicClosingItems
      .filter(i => i.group === 'ENTRADA_INFO')
      .reduce((sum, i) => sum + parseNumericString(closingBreakdown[i.id] || '0'), 0);

    const totalSaidasInfo = dynamicClosingItems
      .filter(i => i.group === 'SAIDA_INFO')
      .reduce((sum, i) => sum + parseNumericString(closingBreakdown[i.id] || '0'), 0);

    // Cálculo de Conferência (DINHEIRO + CHEQUE) do sistema
    const expected = db.calculateExpectedValue(companyId, activeSession, 'vista', [], financeCategories, 'ENTRADA') +
      db.calculateExpectedValue(companyId, activeSession, 'cheque', [], financeCategories, 'ENTRADA');

    return { expected, totalFisico, totalEntradasInfo, totalSaidasInfo };
  }, [activeSession, closingBreakdown, dynamicClosingItems, companyId, financeCategories, refreshKey]);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden p-1 animate-in fade-in">
      {editingRecordId && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-pulse no-print">
          <div className="bg-brand-warning text-black flex items-center justify-center gap-3 py-3 px-4 shadow-[0_4px_20px_rgba(245,158,11,0.5)] border-b-2 border-black/10">
            <ShieldAlert size={20} className="shrink-0" />
            <div className="text-center">
              <p className="text-xs md:text-sm font-black uppercase tracking-[0.1em]">Atenção: Modo Edição de Pedido Ativado</p>
              <p className="text-[10px] font-bold opacity-80 hidden sm:block">Conclua a operação para enviar as alterações para aprovação do gestor.</p>
            </div>
            <button
              onClick={() => { setEditingRecordId(null); setCart([]); setSelectedPartnerId(''); }}
              className="ml-4 p-1.5 bg-black/10 hover:bg-black/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <header className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 px-1 no-print bg-slate-900/20 p-4 rounded-2xl border border-slate-800 transition-all ${editingRecordId ? 'mt-14 md:mt-12' : ''}`}>
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2 text-white uppercase tracking-tight">
            <ShoppingCart className="text-brand-success" size={24} /> Terminal PDV
          </h1>
          {activeSession && <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Operador: {activeSession.userName || activeSession.user_name} • Turno Aberto às {new Date(activeSession.openingTime || '').toLocaleTimeString()}</p>}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          {!activeSession ? (
            <button onClick={() => { triggerRefresh(); setIsOpeningModalOpen(true); }} className="bg-brand-success text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-brand-success/20 active:scale-95 transition-all"><Unlock size={18} /> Iniciar Turno</button>
          ) : (
            <>
              <button onClick={() => setIsHistoryModalOpen(true)} className="bg-slate-800 text-brand-success px-4 py-2.5 rounded-xl font-black text-[10px] uppercase border border-slate-700 flex items-center gap-2 hover:bg-slate-700 transition-all"><HistoryIcon size={14} /> Histórico</button>
              <button onClick={() => { setEditingRecordId(null); setManualEntryForm({ tipo: 'saída', valor: '', categoria: '', descricao: '', paymentTermId: '' }); setIsManualEntryModalOpen(true); }} className="bg-slate-800 text-brand-success px-4 py-2.5 rounded-xl font-black text-[10px] uppercase border border-slate-700 flex items-center gap-2 hover:bg-slate-700 transition-all"><PlusCircle size={14} /> Lançamento</button>
              <button onClick={handleTryClose} disabled={isClosePending} className={`${isClosePending ? 'bg-slate-700 text-slate-500' : 'bg-brand-error text-white'} px-6 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg border border-white/10 flex items-center gap-2 active:scale-95 transition-all`}>{isClosePending ? <Loader2 className="animate-pulse" size={14} /> : <Lock size={14} />}{isClosePending ? 'Aguardando Liberação' : 'Encerrar Caixa'}</button>
            </>
          )}
        </div>
      </header>

      {activeSession && (
        <div className="flex flex-col lg:flex-row gap-6 no-print">
          <div className="flex-1 space-y-6">
            <div className="enterprise-card p-4 flex flex-col md:flex-row gap-4 items-center bg-slate-900/50">
              <div className="flex bg-brand-dark p-1 rounded-xl border border-slate-800 w-full md:w-auto">
                {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.profile === OperationalProfile.MASTER || currentUser?.permissions.includes(PermissionModule.PURCHASES_VIEW)) && (
                  <button onClick={() => { if (!editingRecordId) { setType('buy'); setCart([]); setSelectedPartnerId(''); } }} className={`flex-1 md:px-8 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${type === 'buy' ? 'bg-brand-warning text-white' : 'text-slate-500'}`}>Compra</button>
                )}
                {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.profile === OperationalProfile.MASTER || currentUser?.permissions.includes(PermissionModule.SALES_VIEW)) && (
                  <button onClick={() => { if (!editingRecordId) { setType('sell'); setCart([]); setSelectedPartnerId(''); } }} className={`flex-1 md:px-8 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${type === 'sell' ? 'bg-brand-success text-white' : 'text-slate-500'}`}>Venda</button>
                )}
              </div>
              <div className="flex-1 flex items-center gap-4 bg-brand-dark border border-slate-800 rounded-xl px-4 py-2.5 w-full focus-within:border-brand-success transition-all">
                <Search size={18} className="text-slate-500" /><input type="text" placeholder="Localizar material..." className="bg-transparent border-none focus:ring-0 text-sm flex-1 outline-none text-white font-medium" value={search} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar p-1">
              {materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase())).map(m => (
                <button key={m.id} onClick={() => addToCart(m)} className="enterprise-card p-4 hover:border-brand-success hover:scale-[1.02] transition-all text-left flex flex-col justify-between h-40 bg-slate-900/40 group">
                  <div className="flex justify-between items-start"><div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:text-brand-success"><Package size={20} /></div><span className="text-[10px] font-black text-slate-500 uppercase">{m.unit}</span></div>
                  <div className="mt-4"><p className="font-bold text-xs truncate text-slate-200 uppercase">{m.name}</p><p className={`text-lg font-black mt-1 ${type === 'buy' ? 'text-brand-warning' : 'text-brand-success'}`}>R$ {(type === 'buy' ? m.buyPrice : m.sellPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[450px] shrink-0">
            <div className="enterprise-card flex flex-col h-auto lg:h-[calc(100vh-160px)] border-slate-800 shadow-2xl bg-slate-900/40 relative">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center"><h3 className="font-black flex items-center gap-3 text-white uppercase text-sm tracking-widest">Cupom</h3><span className="text-[10px] font-black text-brand-success bg-brand-success/10 px-3 py-1.5 rounded-full border border-brand-success/20">{cart.length}</span></div>
              <div className="p-4 border-b border-slate-800/50 bg-slate-900/20 z-[60]" ref={partnerMenuRef}>
                <div className="relative">
                  <button onClick={() => setIsPartnerMenuOpen(!isPartnerMenuOpen)} className="w-full bg-brand-dark border border-slate-800 rounded-xl p-3 text-xs text-white flex items-center justify-between hover:border-brand-success transition-all outline-none">
                    <span className={`truncate font-bold uppercase ${selectedPartner ? 'text-white' : 'text-slate-500'}`}>{selectedPartner ? selectedPartner.name : 'Selecionar Parceiro...'}</span>
                    <ChevronDown size={18} className={`transition-transform duration-300 ${isPartnerMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isPartnerMenuOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/50"><Search size={14} className="text-slate-500" /><input type="text" autoFocus placeholder="Filtrar..." className="w-full bg-transparent border-none text-xs text-white outline-none uppercase font-bold" value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)} /></div>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">{sortedPartners.map(p => (<button key={p.id} onClick={() => { setSelectedPartnerId(p.id); setIsPartnerMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-brand-success/10 text-[10px] font-bold text-slate-300 uppercase transition-colors border-b border-slate-800/30 last:border-0 flex items-center justify-between"><span>{p.name}</span><ChevronRight size={12} className="text-brand-success" /></button>))}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3 relative">
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="absolute top-4 right-4 text-slate-600 hover:text-brand-error transition-colors p-1"><X size={16} /></button>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[80%]">{item.material.name}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[8px] uppercase text-slate-600 font-black">Qtd ({item.unit})</label><input type="number" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-white font-black text-center focus:border-brand-success outline-none" value={item.quantity} onChange={e => setCart(cart.map(i => i.id === item.id ? { ...i, quantity: parseFloat(e.target.value) || 0 } : i))} /></div>
                      <div className="space-y-1"><label className="text-[8px] uppercase text-slate-600 font-black">Preço Unit.</label><input type="number" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-white font-black text-center focus:border-brand-success outline-none" value={item.appliedPrice} onChange={e => setCart(cart.map(i => i.id === item.id ? { ...i, appliedPrice: parseFloat(e.target.value) || 0 } : i))} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-8 border-t border-slate-800 bg-slate-900/50 space-y-6 mt-auto">
                <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] font-black uppercase">Total Bruto</span><span className="text-3xl font-black text-white">R$ {cart.reduce((s, i) => s + (i.quantity * i.appliedPrice), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className={`flex gap-3 ${editingRecordId ? 'flex-col sm:flex-row' : 'flex-col'}`}>
                  <button onClick={handleCheckout} disabled={isSubmitting || cart.length === 0 || !selectedPartnerId} className="flex-1 py-5 bg-brand-success text-white font-black uppercase text-xs tracking-[0.3em] rounded-2xl shadow-xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingRecordId ? 'PEDIR LIBERAÇÃO' : 'CONCLUIR OPERAÇÃO')}</button>
                  {editingRecordId && <button onClick={() => { setEditingRecordId(null); setCart([]); setSelectedPartnerId(''); }} className="py-5 px-6 bg-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-slate-700 transition-all border border-slate-700">CANCELAR</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center"><h2 className="text-xl font-black text-white uppercase flex items-center gap-3"><HistoryIcon size={24} className="text-brand-success" /> Histórico do Turno</h2><button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-500 hover:text-white"><X size={32} /></button></div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <table className="w-full text-left">
                <thead><tr className="text-[10px] font-black text-slate-500 uppercase border-b border-slate-800 bg-slate-900/40"><th className="px-4 py-4">Horário</th><th className="px-4 py-4">Parceiro</th><th className="px-4 py-4">Lançamento</th><th className="px-4 py-4">Meio / Prazo</th><th className="px-4 py-4 text-right">Valor</th><th className="px-4 py-4 text-center">Status</th><th className="px-4 py-4 text-center">Ação</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {historyRecords.map(rec => {
                    const statusInfo = getStatusInfo(rec); const partner = partners.find(p => p.id === rec.parceiro_id);
                    const terms = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);
                    const term = terms.find(t => t.id === rec.paymentTermId || t.uuid === rec.paymentTermId || t.id === rec.payment_term_id || t.uuid === rec.payment_term_id);
                    const isPendingAction = pendingRequests.some(r => r.status === 'PENDING' && r.action_label.includes(rec.id.slice(-5)));
                    const isThisRecordBeingEdited = editingRecordId === rec.id;

                    return (
                      <tr key={rec.id} className={`text-xs hover:bg-slate-800/20 transition-colors ${statusInfo.isStriked ? 'opacity-40 grayscale line-through text-slate-600' : ''}`}>
                        <td className="px-4 py-4 font-mono text-slate-500">{new Date(rec.created_at).toLocaleTimeString('pt-BR')}</td>
                        <td className="px-4 py-4 text-slate-400 font-bold uppercase truncate max-w-[150px]">{partner?.name || '---'}</td>
                        <td className="px-4 py-4 text-slate-300 font-bold uppercase truncate max-w-md">
                          {isPendingAction && <span className="text-brand-warning mr-2">[PEDIDO PENDENTE]</span>}
                          {isThisRecordBeingEdited && <span className="text-blue-400 mr-2">[EM EDIÇÃO]</span>}
                          {rec.caixa_id !== activeSession?.id && rec.status === 'paid' && (
                            <span className="text-purple-400 mr-2 bg-purple-500/10 border border-purple-500/20 px-1 rounded uppercase font-black text-[9px]">
                              [BAIXADO EM: #{rec.caixa_id?.slice(0, 8).toUpperCase()}]
                            </span>
                          )}
                          {rec.description}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            {statusInfo.label === 'PENDENTE' ? '---' : (term?.name || (rec.liquidation_date ? 'À VISTA' : '---'))}
                          </span>
                        </td>
                        <td className={`px-4 py-4 text-right font-black ${rec.natureza === 'ENTRADA' ? 'text-brand-success' : 'text-brand-error'}`}>R$ {rec.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-center"><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${statusInfo.color}`}>{statusInfo.label}</span></td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            {statusInfo.label !== 'CANCELADO' && (rec.transaction_id || rec.categoria === 'Abertura de Caixa' || rec.tipo === 'suprimento' || rec.tipo === 'sangria') && (
                              <button onClick={() => {
                                if (rec.transaction_id) {
                                  const trans = db.queryTenant<Transaction>('transactions', companyId).find(t => t.id === rec.transaction_id);
                                  if (trans) {
                                    // Vincula parceiro para o recibo a partir do registro financeiro
                                    setViewingTransactionForPrint({ ...trans, parceiro_id: rec.parceiro_id } as any);
                                  }
                                } else {
                                  setViewingTransactionForPrint({
                                    id: rec.id,
                                    user_id: rec.usuario_id || rec.user_id || '',
                                    valor: rec.valor,
                                    status: 'completed',
                                    natureza: rec.natureza,
                                    items: [{ id: 'm1', materialName: rec.description || rec.categoria, quantity: 1, price: rec.valor, total: rec.valor, unit: 'UN' }],
                                    created_at: rec.created_at,
                                    parceiro_id: rec.parceiro_id
                                  } as any);
                                }
                              }} className="p-2 bg-slate-700/50 text-brand-success rounded-lg" title="Imprimir Recibo"><Printer size={16} /></button>
                            )}
                            {!isPendingAction && statusInfo.label !== 'CANCELADO' && (
                              <>
                                {statusInfo.label === 'PENDENTE' && (
                                  <button
                                    onClick={() => { const dDate = rec.dueDate || rec.due_date || db.getToday(); setPaymentDefModal({ show: true, record: rec, termId: '', dueDate: dDate, receivedValue: '' }); }}
                                    disabled={isThisRecordBeingEdited}
                                    className={`p-2 rounded-lg transition-all ${isThisRecordBeingEdited ? 'bg-slate-800 text-slate-600' : 'bg-brand-success/10 text-brand-success'}`}
                                    title={isThisRecordBeingEdited ? "Operação Bloqueada (Registro em Edição)" : "Finalizar Pendência"}
                                  >
                                    <CreditCard size={16} />
                                  </button>
                                )}
                                {statusInfo.label !== 'LIQUIDADO' && (
                                  <button onClick={() => { if (rec.transaction_id) { const tx = db.queryTenant<Transaction>('transactions', companyId).find(t => t.id === rec.transaction_id); if (tx) { setEditingRecordId(rec.id); setType(tx.natureza === 'SAIDA' ? 'buy' : 'sell'); setSelectedPartnerId(rec.parceiro_id || ''); setCart(tx.items.map(i => ({ id: i.id, material: materials.find(m => m.id === i.materialId)!, quantity: i.quantity, unit: i.unit as any, systemPrice: i.price, appliedPrice: i.price }))); setIsHistoryModalOpen(false); } } else { setEditingRecordId(rec.id); setManualEntryForm({ tipo: rec.natureza === 'ENTRADA' ? 'entrada' : 'saída', valor: rec.valor.toString(), categoria: rec.categoria, descricao: rec.description, paymentTermId: rec.paymentTermId || '' }); setIsManualEntryModalOpen(true); } }} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg" title="Editar"><Edit2 size={16} /></button>
                                )}
                                {statusInfo.label !== 'LIQUIDADO' && (
                                  <button onClick={() => { setPendingDeleteRecordId(rec.id); setIsRequestDeleteAuthModalOpen(true); }} className="p-2 bg-brand-error/10 text-brand-error rounded-lg" title="Cancelar Lançamento"><Trash2 size={16} /></button>
                                )}
                                {statusInfo.label !== 'PENDENTE' && (
                                  (() => {
                                    const recordSession = allSessions.find(s => s.id === rec.caixa_id);
                                    const isFinanceLiquidation = recordSession?.type === 'finance';
                                    if (isFinanceLiquidation) return null;

                                    return (
                                      <button onClick={() => { setPendingVoidRecordId(rec.id); setIsRequestAuthModalOpen(true); }} className="p-2 bg-brand-warning/10 text-brand-warning rounded-lg" title="Estornar para Pendente"><RotateCcw size={16} /></button>
                                    );
                                  })()
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ABERTURA */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/98 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-sm p-8 border-slate-700 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-brand-success/10 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-success border border-brand-success/20">{editingRecordId ? <Edit2 size={32} /> : <Unlock size={32} />}</div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-8">{editingRecordId ? 'Ajustar Abertura' : 'Abertura de Terminal'}</h2>

            {isLoadingData ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <Loader2 className="animate-spin text-brand-success" size={32} />
                <p className="text-[10px] font-black uppercase text-slate-500">Buscando cadastros...</p>
              </div>
            ) : (
              <form onSubmit={handleOpenCashierSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">Fundo de Troco Inicial (BRL)</label>
                    <input required autoFocus type="text" placeholder="0,00" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white text-3xl font-black text-center outline-none focus:border-brand-success transition-all" value={openingBalanceInput} onChange={e => setOpeningBalanceInput(e.target.value)} />
                  </div>

                  {!editingRecordId && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-2"><Landmark size={12} /> Conta Bancária (Origem)</label>
                        <select required className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={openingBankId} onChange={e => setOpeningBankId(e.target.value)}>
                          <option value="">SELECIONE A CONTA...</option>
                          {banks.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-2"><ArrowRightLeft size={12} /> Meio de Pagamento</label>
                        <select required className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={openingTermId} onChange={e => setOpeningTermId(e.target.value)}>
                          <option value="">SELECIONE A FORMA...</option>
                          {openingTerms.map(t => <option key={t.id} value={t.uuid || t.id}>{t.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsOpeningModalOpen(false); setEditingRecordId(null); }}
                    className="flex-1 py-5 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-700 hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    disabled={isOpening}
                    className="flex-[2] py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-success/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {isOpening ? <Loader2 className="animate-spin" size={18} /> : <Unlock size={18} />}
                    {isOpening ? 'Processando...' : (editingRecordId ? 'SOLICITAR AJUSTE' : 'CONFIRMAR ABERTURA')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE ENCERRAMENTO */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/98 backdrop-blur-xl p-4 animate-in fade-in overflow-y-auto">
          <div className="enterprise-card w-full max-w-6xl my-auto overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-slate-700/50 animate-in zoom-in-95 bg-slate-900/90">
            {/* Header com Metadados */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-error/10 rounded-2xl flex items-center justify-center text-brand-error border border-brand-error/20">
                  <Lock size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">Fechamento de Caixa</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><UserIcon size={12} /> {activeSession?.userName || activeSession?.user_name}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><Receipt size={12} /> Turno: #{activeSession?.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-[10px] font-black text-brand-success uppercase flex items-center gap-1.5"><Clock size={12} /> Aberto às {new Date(activeSession?.openingTime || '').toLocaleTimeString()}</span>
                    <span className="text-[10px] font-black text-brand-warning uppercase flex items-center gap-1.5"><Zap size={12} /> Período: {operationalTime}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsClosingModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form ref={closingFormRef} onSubmit={handleFinalClose} className="p-8 space-y-8">
              {/* Balões de Resumo Rápido */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-success/10 rounded-xl flex items-center justify-center text-brand-success"><Banknote size={20} /></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Saldo Físico em Mãos</p>
                    <p className="text-xl font-black text-white mt-1">R$ {closingMetrics.totalFisico.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><ArrowUpCircle size={20} /></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Entradas</p>
                    <p className="text-xl font-black text-white mt-1">R$ {closingMetrics.totalEntradasInfo.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-error/10 rounded-xl flex items-center justify-center text-brand-error"><ArrowDownCircle size={20} /></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Saídas</p>
                    <p className="text-xl font-black text-brand-error mt-1">- R$ {closingMetrics.totalSaidasInfo.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Grid de Campos Categorizados */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[50vh] overflow-y-auto custom-scrollbar pr-4">

                {/* Coluna 1: FISICO */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
                    <CashIcon size={14} className="text-brand-success" /> Conferência Balcão
                  </h3>
                  <div className="space-y-4">
                    {dynamicClosingItems.filter(i => i.group === 'FISICO').map(item => (
                      <div key={item.id} className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{item.label}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input required type="text" onKeyDown={handleClosingKeyDown} placeholder="0,00" className="w-full bg-slate-950 border border-slate-800 p-4 pl-10 rounded-xl text-white font-black text-lg outline-none focus:border-brand-success focus:ring-1 focus:ring-brand-success/20 transition-all" value={closingBreakdown[item.id] || ''} onChange={e => setClosingBreakdown({ ...closingBreakdown, [item.id]: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coluna 2: ENTRADAS INFO */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
                    <ArrowUpCircle size={14} className="text-brand-success" /> Detalhamento Entradas
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {dynamicClosingItems.filter(i => i.group === 'ENTRADA_INFO').map(item => (
                      <div key={item.id} className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{item.label}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input type="text" onKeyDown={handleClosingKeyDown} placeholder="0,00" className="w-full bg-slate-900/50 border border-slate-800 p-3 pl-10 rounded-xl text-white font-bold text-sm outline-none focus:border-blue-500 transition-all" value={closingBreakdown[item.id] || ''} onChange={e => setClosingBreakdown({ ...closingBreakdown, [item.id]: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coluna 3: SAIDAS INFO */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
                    <ArrowDownCircle size={14} className="text-brand-error" /> Detalhamento Saídas
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {dynamicClosingItems.filter(i => i.group === 'SAIDA_INFO').map(item => (
                      <div key={item.id} className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{item.label}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input type="text" onKeyDown={handleClosingKeyDown} placeholder="0,00" className="w-full bg-slate-900/50 border border-slate-800 p-3 pl-10 rounded-xl text-white font-bold text-sm outline-none focus:border-brand-error/50 transition-all" value={closingBreakdown[item.id] || ''} onChange={e => setClosingBreakdown({ ...closingBreakdown, [item.id]: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer com Botão de Ação */}
              <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-end items-center gap-6">
                <button type="submit" className="w-full md:w-auto px-12 py-5 bg-brand-error text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-brand-error/20 hover:scale-105 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 size={20} /> Confirmar e Encerrar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LANÇAMENTO MANUAL */}
      {isManualEntryModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-md overflow-hidden shadow-2xl border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3"><PlusCircle className="text-brand-success" /> Lançamento no Turno</h2>
              <button onClick={() => setIsManualEntryModalOpen(false)}><X size={24} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleManualEntrySubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setManualEntryForm({ ...manualEntryForm, tipo: 'entrada' })} className={`py-4 rounded-xl font-black text-[10px] uppercase transition-all ${manualEntryForm.tipo === 'entrada' ? 'bg-brand-success text-white' : 'bg-slate-800 text-slate-500'}`}>Entrada (+)</button>
                <button type="button" onClick={() => setManualEntryForm({ ...manualEntryForm, tipo: 'saída' })} className={`py-4 rounded-xl font-black text-[10px] uppercase transition-all ${manualEntryForm.tipo === 'saída' ? 'bg-brand-error text-white' : 'bg-slate-800 text-slate-500'}`}>Saída (-)</button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">Valor do Lançamento</label>
                <input required placeholder="0,00" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-black text-3xl text-center outline-none focus:border-brand-success transition-all" value={manualEntryForm.valor} onChange={e => setManualEntryForm({ ...manualEntryForm, valor: e.target.value })} />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Meio de Pagamento</label>
                  <select required className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={manualEntryForm.paymentTermId} onChange={e => setManualEntryForm({ ...manualEntryForm, paymentTermId: e.target.value })}>
                    <option value="">SELECIONE A FORMA...</option>
                    {filteredManualPdvTerms.map(t => <option key={t.id} value={t.id || t.uuid}>{t.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Categoria</label>
                  <select required className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={manualEntryForm.categoria} onChange={e => setManualEntryForm({ ...manualEntryForm, categoria: e.target.value })}>
                    <option value="">SELECIONE A CATEGORIA...</option>
                    {categoriesManual.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Descrição</label>
                  <input placeholder="Ex: Pagamento de Frete" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={manualEntryForm.descricao} onChange={e => setManualEntryForm({ ...manualEntryForm, descricao: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-brand-success/20 hover:scale-[1.01] active:scale-95 transition-all">
                {editingRecordId ? 'PEDIR LIBERAÇÃO ALTERAÇÃO' : 'SOLICITAR LANÇAMENTO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEFINIÇÃO PAGAMENTO */}
      {paymentDefModal.show && paymentDefModal.record && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-md overflow-hidden shadow-2xl border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3"><CreditCard className="text-brand-success" /> Finalizar Operação</h2>
              <button onClick={() => setPaymentDefModal({ show: false, record: null, termId: '', dueDate: '', receivedValue: '' })}><X size={24} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleConfirmPaymentDefinition} className="p-8 space-y-6">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total do Pedido</p>
                <p className="text-white font-black text-2xl">R$ {paymentDefModal.record.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Meio de Pagamento</label>
                  <select
                    required
                    className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success"
                    value={paymentDefModal.termId}
                    onChange={e => {
                      const selId = e.target.value;
                      const terms = paymentDefModal.record?.natureza === 'SAIDA' ? purchasePaymentTerms : salePaymentTerms;
                      const term = terms.find(t => t.id === selId || t.uuid === selId);
                      const days = term?.days || 0;
                      const calcDate = new Date();
                      calcDate.setDate(calcDate.getDate() + days);
                      setPaymentDefModal({ ...paymentDefModal, termId: selId, dueDate: calcDate.toISOString().split('T')[0] });
                    }}
                  >
                    <option value="">SELECIONE A FORMA...</option>
                    {(paymentDefModal.record.natureza === 'SAIDA' ? purchasePaymentTerms : salePaymentTerms).map(t => <option key={t.id} value={t.id || t.uuid}>{t.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Data do Pagamento / Vencimento</label>
                  <input type="date" required className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={paymentDefModal.dueDate} onChange={e => setPaymentDefModal({ ...paymentDefModal, dueDate: e.target.value })} />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-brand-success/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Confirmar e Finalizar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP DE AVISO */}
      {warningPopup && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/98 p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-sm p-8 text-center space-y-4 border-brand-error/20 bg-brand-error/5">
            <div className="w-20 h-20 bg-brand-error/10 rounded-full flex items-center justify-center mx-auto text-brand-error border border-brand-error/20"><AlertCircle size={40} /></div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{warningPopup.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{warningPopup.message}</p>
            <button onClick={() => setWarningPopup(null)} className="w-full py-4 bg-brand-error text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-brand-error/20 active:scale-95 transition-all">Entendido</button>
          </div>
        </div>
      )}

      {/* PREVIEW IMPRESSÃO RECIBO */}
      {viewingTransactionForPrint && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-sm overflow-hidden shadow-2xl border-slate-700 bg-white text-black p-8 font-mono text-[10px]">
            <div className="text-center space-y-1 mb-6 border-b-2 border-dashed border-black pb-4">
              <p className="text-base font-black uppercase">Sucata Fácil Enterprise</p>
              <p className="uppercase">{currentCompany?.name}</p>
              <p className="uppercase">{currentCompany?.cnpj}</p>
              <p className="uppercase">COMPROVANTE DE OPERAÇÃO</p>
            </div>
            <div className="space-y-1 mb-4">
              <p className="flex justify-between"><span>DATA/HORA:</span> <span>{new Date(viewingTransactionForPrint.created_at).toLocaleString()}</span></p>
              <p className="flex justify-between"><span>TIPO:</span> <span className="font-black uppercase">{viewingTransactionForPrint.natureza === 'SAIDA' ? 'COMPRA' : 'VENDA'}</span></p>
              <p className="flex justify-between"><span>PARCEIRO:</span> <span className="font-black uppercase truncate max-w-[150px]">{partners.find(p => p.id === (viewingTransactionForPrint as any).parceiro_id)?.name || 'CONSUMIDOR FINAL'}</span></p>
              <p className="flex justify-between"><span>REF ID:</span> <span>#{viewingTransactionForPrint.id.slice(0, 8).toUpperCase()}</span></p>
            </div>
            <div className="border-y-2 border-dashed border-black py-4 space-y-2 mb-4">
              <div className="flex justify-between font-black uppercase"><span>ITEM</span> <span>QTD</span> <span>TOTAL</span></div>
              {viewingTransactionForPrint.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between uppercase">
                  <span>{item.materialName || item.material_name}</span>
                  <span>{item.quantity} {item.unit}</span>
                  <span>R$ {item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-base font-black mb-8"><span>TOTAL:</span> <span>R$ {viewingTransactionForPrint.valor.toLocaleString()}</span></div>
            <div className="text-center pt-8 border-t-2 border-dashed border-black space-y-4">
              <p className="uppercase">Operador: {currentUser?.name}</p>
              <div className="h-10 border-b border-black w-full mx-auto"></div>
              <p className="uppercase">Assinatura do Parceiro</p>
              <p className="text-[8px] italic">Gerado via Sucata Fácil Cloud - Auditoria v7.0</p>
            </div>
            <div className="mt-8 flex gap-4 no-print">
              <button onClick={() => window.print()} className="flex-1 py-3 bg-black text-white font-black uppercase text-[10px]">Imprimir</button>
              <button onClick={() => setViewingTransactionForPrint(null)} className="flex-1 py-3 border-2 border-black font-black uppercase text-[10px]">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Autorização Remota */}
      <RequestAuthorizationModal
        isOpen={isRequestManualAuthModalOpen}
        onClose={() => setIsRequestManualAuthModalOpen(false)}
        actionKey="LANCAMENTO_MANUAL"
        actionLabel={manualEntryToRequest ? `TIPO: ${manualEntryToRequest.tipo.toUpperCase()} | VAL: R$ 0,00 para R$ ${manualEntryToRequest.valor} | CAT: ${manualEntryToRequest.categoria} | DESC: ${manualEntryToRequest.descricao} | TERM_ID: ${manualEntryToRequest.paymentTermId}` : ''}
      />

      <RequestAuthorizationModal
        isOpen={isRequestEditRecordAuthModalOpen}
        onClose={() => setIsRequestEditRecordAuthModalOpen(false)}
        actionKey="EDITAR_LANCAMENTO"
        actionLabel={editRecordToRequest ? `REAL_ID: ${editRecordToRequest.recordId} | JSON: ${JSON.stringify(editRecordToRequest.data)}` : ''}
      />

      <RequestAuthorizationModal
        isOpen={isRequestEditPosTxAuthModalOpen}
        onClose={() => setIsRequestEditPosTxAuthModalOpen(false)}
        actionKey="EDITAR_OPERACAO_PDV"
        actionLabel={editPosTxToRequest ? `REAL_ID: ${editPosTxToRequest.recordId} | JSON: ${JSON.stringify(editPosTxToRequest)}` : ''}
      />

      <RequestAuthorizationModal
        isOpen={isRequestEditOpeningAuthModalOpen}
        onClose={() => setIsRequestEditOpeningAuthModalOpen(false)}
        actionKey="AJUSTAR_ABERTURA"
        actionLabel={editOpeningToRequest ? `REAL_ID: ${editOpeningToRequest.recordId} | VAL: R$ 0,00 para R$ ${editOpeningToRequest.value}` : ''}
      />

      <RequestAuthorizationModal
        isOpen={isRequestAuthModalOpen}
        onClose={() => setIsRequestAuthModalOpen(false)}
        actionKey="ESTORNAR_LANCAMENTO"
        actionLabel={pendingVoidRecordId ? `REAL_ID: ${pendingVoidRecordId}` : ''}
      />

      <RequestAuthorizationModal
        isOpen={isRequestDeleteAuthModalOpen}
        onClose={() => setIsRequestDeleteAuthModalOpen(false)}
        actionKey="CANCELAR_LANCAMENTO"
        actionLabel={pendingDeleteRecordId ? `REAL_ID: ${pendingDeleteRecordId}` : ''}
      />

      <RequestAuthorizationModal
        isOpen={isRequestCloseAuthModalOpen}
        onClose={() => setIsRequestCloseAuthModalOpen(false)}
        actionKey="FECHAR_CAIXA"
        actionLabel={pendingCloseSessionId ? `FECHAMENTO CAIXA ID: ${pendingCloseSessionId}` : ''}
      />

      {/* PREVIEW IMPRESSÃO FECHAMENTO */}
      {showClosingPrintPreview && lastClosedSession && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-sm overflow-hidden shadow-2xl border-slate-700 bg-white text-black p-8 font-mono text-[10px]">
            <div className="text-center space-y-1 mb-6 border-b-2 border-dashed border-black pb-4">
              <p className="text-base font-black uppercase">Sucata Fácil Enterprise</p>
              <p className="uppercase">RESUMO DE ENCERRAMENTO</p>
            </div>
            <div className="space-y-1 mb-4">
              <p className="flex justify-between"><span>ABERTURA:</span> <span>{new Date(lastClosedSession.session.openingTime || '').toLocaleString()}</span></p>
              <p className="flex justify-between"><span>FECHAMENTO:</span> <span>{new Date(lastClosedSession.session.closingTime || '').toLocaleString()}</span></p>
              {lastClosedSession.session.openingTime && lastClosedSession.session.closingTime && (
                <p className="flex justify-between font-black text-brand-error uppercase"><span>PERÍODO:</span> <span>
                  {(() => {
                    const start = new Date(lastClosedSession.session.openingTime);
                    const end = new Date(lastClosedSession.session.closingTime);
                    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    return `${h}h ${m}min`;
                  })()}
                </span></p>
              )}
              <p className="flex justify-between"><span>OPERADOR:</span> <span className="font-black uppercase">{lastClosedSession.session.userName || lastClosedSession.session.user_name}</span></p>
              <p className="flex justify-between"><span>TURNO ID:</span> <span>#{lastClosedSession.session.id.slice(0, 8).toUpperCase()}</span></p>
            </div>
            <div className="border-y-2 border-dashed border-black py-4 space-y-2 mb-4">
              <p className="flex justify-between"><span>ABERTURA (TROCO):</span> <span>R$ {(lastClosedSession.session.openingBalance || lastClosedSession.session.opening_balance || 0).toLocaleString()}</span></p>
              <p className="flex justify-between font-black uppercase"><span>MÉTRICAS FÍSICAS:</span></p>
              <p className="flex justify-between"><span>FISICO INFORMADO:</span> <span>R$ {(lastClosedSession.session.closingBalance || lastClosedSession.session.closing_balance || 0).toLocaleString()}</span></p>
              <p className="flex justify-between"><span>SISTEMA ESPERADO:</span> <span>R$ {(lastClosedSession.session.expectedBalance || lastClosedSession.session.expected_balance || 0).toLocaleString()}</span></p>
              <p className="flex justify-between font-black border-t border-black pt-1"><span>DIFERENÇA:</span> <span className={(lastClosedSession.session.difference || 0) < 0 ? 'text-red-600' : ''}>R$ {(lastClosedSession.session.difference || 0).toLocaleString()}</span></p>
            </div>
            <div className="text-center pt-8 space-y-4">
              <p className="uppercase">Visto Auditoria Cloud</p>
              <div className="h-10 border-b border-black w-full mx-auto"></div>
              <p className="text-[8px] italic">Turno Encerrado via Auditoria Controlada v3.0</p>
            </div>
            <div className="mt-8 flex gap-4 no-print">
              <button onClick={() => window.print()} className="flex-1 py-3 bg-black text-white font-black uppercase text-[10px]">Imprimir</button>
              <button onClick={() => setShowClosingPrintPreview(false)} className="flex-1 py-3 border-2 border-black font-black uppercase text-[10px]">Concluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;