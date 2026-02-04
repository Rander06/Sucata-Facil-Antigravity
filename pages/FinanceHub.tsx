import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { FinancialRecord, Partner, PaymentTerm, CashierSession, WalletTransaction, Bank, FinanceCategory, User, PermissionModule, UserRole } from '../types';
import {
  Wallet, Landmark, ArrowUpCircle, ArrowDownCircle, Search, Clock,
  ChevronRight, RefreshCw, ListChecks, CheckCircle2, ShieldCheck,
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, X, PlusCircle,
  FileText, Download, Printer, User as UserIcon, Receipt, Zap, Scale,
  CreditCard, Banknote, Landmark as BankIcon, Save, Loader2, Coins,
  Calendar, Eye, Trash2, Edit, RotateCcw, Plus, PlusSquare, Lock, ChevronDown
} from 'lucide-react';
import { getBRDateOnly, formatBRDate } from '../utils/dateHelper';
import { normalizeText } from '../utils/textHelper';
import { formatCurrency } from '../utils/currencyHelper';
import { TableLayout } from '../components/FinanceTableLayout';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import { authorizationService } from '../services/authorizationService';

const parseNumericString = (val: any) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  try {
    const clean = String(val).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(clean) || 0;
  } catch (e) {
    return 0;
  }
};

/**
 * Corrige problemas de encoding UTF-8 em textos do banco de dados
 * Converte caracteres mal codificados para seus equivalentes corretos
 */
const fixEncoding = (text: string): string => {
  if (!text) return '';

  return text
    .replace(/DEPÃ"SITO/g, 'DEPÓSITO')
    .replace(/DEPÃƒÂ"SITO/g, 'DEPÓSITO')
    .replace(/Ã"/g, 'Ó')
    .replace(/Ã©/g, 'é')
    .replace(/Ã/g, 'Á')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã­/g, 'í')
    .replace(/Ã'/g, 'à')
    .replace(/Ã/g, 'É')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã/g, 'Í')
    .replace(/Ã'/g, 'À')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ãƒ/g, 'Ã');
};

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



const FinanceHub: React.FC = () => {
  const { currentUser, currentCompany, pendingRequests, refreshRequests } = useAppContext();
  const companyId = currentUser?.companyId || currentUser?.company_id || null;

  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const [walletFilterOperator, setWalletFilterOperator] = useState(''); // Novo filtro de operador

  // Authorization State
  const [isRequestEditAuthModalOpen, setIsRequestEditAuthModalOpen] = useState(false);
  const [isRequestDeleteAuthModalOpen, setIsRequestDeleteAuthModalOpen] = useState(false);
  const [txToAuthorize, setTxToAuthorize] = useState<WalletTransaction | null>(null);
  const [recordToReverse, setRecordToReverse] = useState<FinancialRecord | null>(null);
  const [manualEntryToAuthorize, setManualEntryToAuthorize] = useState<any>(null);
  const [isRequestManualAuthModalOpen, setIsRequestManualAuthModalOpen] = useState(false);
  const [isRequestReverseAuthModalOpen, setIsRequestReverseAuthModalOpen] = useState(false);
  const [isRequestReverseLiquidationAuthModalOpen, setIsRequestReverseLiquidationAuthModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<FinancialRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecord | null>(null);
  const [pendingEditPayload, setPendingEditPayload] = useState<any | null>(null);
  const [isRequestEditLiquidationAuthModalOpen, setIsRequestEditLiquidationAuthModalOpen] = useState(false);
  const [isRequestDeleteLiquidationAuthModalOpen, setIsRequestDeleteLiquidationAuthModalOpen] = useState(false);
  const [isRequestReverseAuditAuthModalOpen, setIsRequestReverseAuditAuthModalOpen] = useState(false);
  const [auditToReverse, setAuditToReverse] = useState<CashierSession | null>(null);
  const processedAuthIds = useRef(new Set<string>());

  const [isLoading, setIsLoading] = useState(false);
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const auditFormRef = useRef<HTMLFormElement>(null);




  const getSystemValue = (itemId: string, group: string) => {
    if (!auditModal.session) return 0;
    const session = auditModal.session;
    const records = db.queryTenant<FinancialRecord>('financials', companyId, f => f.caixa_id === session.id && f.status !== 'reversed');

    // 1. Campos Físicos (DINHEIRO / CHEQUE)
    if (itemId === 'physical_cash') return db.calculateExpectedValue(companyId, session, 'vista', [], financeCategories, 'ENTRADA');
    if (itemId === 'physical_check') return db.calculateExpectedValue(companyId, session, 'cheque', [], financeCategories, 'ENTRADA');

    // 2. Campos Dinâmicos de Categoria (cat_<categoria>_<natureza>)
    if (itemId.startsWith('cat_')) {
      const parts = itemId.split('_');
      const natureza = parts[parts.length - 1]; // Última parte é a natureza
      const categoria = parts.slice(1, -1).join('_'); // Tudo entre cat_ e _natureza

      return records
        .filter(f => f.categoria === categoria && f.natureza === natureza)
        .reduce((sum, r) => sum + r.valor, 0);
    }

    // 3. Campos Dinâmicos de Payment Term (term_<nome>_<natureza>)
    if (itemId.startsWith('term_')) {
      const parts = itemId.split('_');
      const natureza = parts[parts.length - 1]; // Última parte é a natureza
      const termName = parts.slice(1, -1).join('_'); // Tudo entre term_ e _natureza

      return records
        .filter(f => {
          const termId = f.payment_term_id || f.paymentTermId;
          if (!termId) return false;
          const term = allPaymentTerms.find(t => t.id === termId || t.uuid === termId);
          return term && term.name === termName && f.natureza === natureza;
        })
        .reduce((sum, r) => sum + r.valor, 0);
    }

    return 0;
  };

  const handleAuditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = auditFormRef.current;
      if (!form) return;
      const index = Array.from(form.elements).indexOf(e.currentTarget as any);
      if (index > -1) {
        const nextElement = form.elements[index + 1] as HTMLElement;
        if (nextElement && (nextElement.tagName === 'INPUT' || nextElement.tagName === 'SELECT' || nextElement.tagName === 'BUTTON')) {
          nextElement.focus();
        } else {
          handleProcessReconciliation(e as any);
        }
      }
    }
  };
  const [allFinancialRecords, setAllFinancialRecords] = useState<FinancialRecord[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [purchasePaymentTerms, setPurchasePaymentTerms] = useState<PaymentTerm[]>([]);
  const [salePaymentTerms, setSalePaymentTerms] = useState<PaymentTerm[]>([]);
  const [allHubTerms, setAllHubTerms] = useState<PaymentTerm[]>([]);
  const [allPaymentTerms, setAllPaymentTerms] = useState<PaymentTerm[]>([]);
  const [bankManualTerms, setBankManualTerms] = useState<PaymentTerm[]>([]);

  const [banks, setBanks] = useState<Bank[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [cashierSessions, setCashierSessions] = useState<CashierSession[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [activeSession, setActiveSession] = useState<CashierSession | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ENTRADA' | 'SAIDA'>('ALL');

  const [walletFilterBanco, setWalletFilterBanco] = useState('');
  const [walletFilterForma, setWalletFilterForma] = useState('');

  const [activeModal, setActiveModal] = useState<'baixas' | 'carteira' | 'conferencia' | null>(null);
  const [showWalletManualEntry, setShowWalletManualEntry] = useState(false);

  const [dateStart, setDateStart] = useState(db.getToday());
  const [dateEnd, setDateEnd] = useState(db.getToday());

  const [auditDateStart, setAuditDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [auditDateEnd, setAuditDateEnd] = useState(db.getToday());
  const [auditOperatorFilter, setAuditOperatorFilter] = useState('all');
  const [auditAuditorFilter, setAuditAuditorFilter] = useState('all');
  const [auditFilterSessionId, setAuditFilterSessionId] = useState('');
  const [auditFilterStatus, setAuditFilterStatus] = useState('all');

  // Filtros da tabela de movimentações do turno
  const [auditTransactionFilters, setAuditTransactionFilters] = useState({
    description: '',
    status: 'all',
    paymentTerm: '',
    nature: 'all'
  });

  // Novos filtros para Liquidação
  const [filterSession, setFilterSession] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPartner, setFilterPartner] = useState('');

  const [liquidationModal, setLiquidationModal] = useState<{
    show: boolean;
    record: FinancialRecord | null;
    termId: string;
    dueDate: string;
    receivedValue: string;
  }>({ show: false, record: null, termId: '', dueDate: '', receivedValue: '' });

  const [auditModal, setAuditModal] = useState<{
    show: boolean;
    session: CashierSession | null;
    bankNameCash: string;
    bankNameCheck: string;
    auditedBreakdown: Record<string, string>;
    readOnly?: boolean;
  }>({ show: false, session: null, bankNameCash: '', bankNameCheck: '', auditedBreakdown: {} });

  const [walletForm, setWalletForm] = useState({
    tipo: 'ENTRADA' as 'ENTRADA' | 'SAIDA',
    valor: '',
    categoria: '',
    parceiro: '',
    payment_term_id: '',
    descricao: '',
    id: '' // Para ediÃ§Ã£o
  });

  // FINANCE CASHIER STATES
  const [activeFinanceSession, setActiveFinanceSession] = useState<CashierSession | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [financeOpeningBalance, setFinanceOpeningBalance] = useState('');
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingBreakdown, setClosingBreakdown] = useState<Record<string, string>>({});
  const [operationalTime, setOperationalTime] = useState('');
  const [isClosingShift, setIsClosingShift] = useState(false);
  const closingFormRef = useRef<HTMLFormElement>(null);

  // EFICIENTE: Mantém o cronômetro do turno ativo
  useEffect(() => {
    if (!activeFinanceSession?.openingTime) {
      setOperationalTime('');
      return;
    }
    const updateTime = () => {
      const open = new Date(activeFinanceSession.openingTime!);
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
  }, [activeFinanceSession?.openingTime]);

  const dynamicClosingItems = useMemo(() => {
    if (!activeFinanceSession) return [];
    const items: { id: string, label: string, group: 'ENTRADA' | 'SAIDA' | 'FISICO' | 'ENTRADA_INFO' | 'SAIDA_INFO' }[] = [];

    // GRUPO FISICO (Sempre presente)
    items.push({ id: 'physical_cash', label: 'DINHEIRO EM MÃOS', group: 'FISICO' });
    items.push({ id: 'physical_check', label: 'CHEQUE EM MÃOS', group: 'FISICO' });

    // Buscar registros deste turno
    const shiftRecords = allFinancialRecords.filter(r => r.caixa_id === activeFinanceSession.id && r.status !== 'reversed');

    // Categorias Únicas
    const excludedCategories = ['Compra de Materiais', 'Venda de Materiais'];
    const categoryMap = new Map<string, { natureza: string, total: number }>();
    shiftRecords.forEach(rec => {
      if (!rec.categoria || !rec.natureza || excludedCategories.includes(rec.categoria)) return;
      const key = `cat_${rec.categoria}_${rec.natureza}`;
      const existing = categoryMap.get(key);
      if (existing) existing.total += rec.valor;
      else categoryMap.set(key, { natureza: rec.natureza, total: rec.valor });
    });

    // Payment Terms únicos (Excluindo Dinheiro/Vista)
    const termMap = new Map<string, { natureza: string, total: number }>();
    shiftRecords.forEach(rec => {
      const tId = rec.payment_term_id || rec.paymentTermId;
      if (!tId) return;
      const term = allPaymentTerms.find(t => t.id === tId || t.uuid === tId);
      if (!term || term.name.includes('DINHEIRO') || term.name === 'À VISTA' || term.name.toUpperCase().includes('CHEQUE')) return;

      const key = `term_${term.name}_${rec.natureza}`;
      const existing = termMap.get(key);
      if (existing) existing.total += rec.valor;
      else termMap.set(key, { natureza: rec.natureza, total: rec.valor });
    });

    categoryMap.forEach((value, key) => {
      const categoria = key.replace(`cat_`, '').replace(`_${value.natureza}`, '');
      items.push({ id: key, label: categoria.toUpperCase(), group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO' });
    });

    termMap.forEach((value, key) => {
      const termName = key.replace(`term_`, '').replace(`_${value.natureza}`, '');
      items.push({ id: key, label: termName.toUpperCase(), group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO' });
    });

    return items;
  }, [activeFinanceSession, allFinancialRecords, allPaymentTerms]);

  const closingMetrics = useMemo(() => {
    if (!activeFinanceSession) return { expected: 0, totalFisico: 0, totalEntradasInfo: 0, totalSaidasInfo: 0 };

    const totalFisico = dynamicClosingItems.filter(i => i.group === 'FISICO').reduce((sum, i) => sum + parseNumericString(closingBreakdown[i.id] || '0'), 0);
    const totalEntradasInfo = dynamicClosingItems.filter(i => i.group === 'ENTRADA_INFO').reduce((sum, i) => sum + parseNumericString(closingBreakdown[i.id] || '0'), 0);
    const totalSaidasInfo = dynamicClosingItems.filter(i => i.group === 'SAIDA_INFO').reduce((sum, i) => sum + parseNumericString(closingBreakdown[i.id] || '0'), 0);

    const expected = db.calculateExpectedValue(companyId, activeFinanceSession, 'vista', [], financeCategories, 'ENTRADA') +
      db.calculateExpectedValue(companyId, activeFinanceSession, 'cheque', [], financeCategories, 'ENTRADA');

    return { expected, totalFisico, totalEntradasInfo, totalSaidasInfo };
  }, [activeFinanceSession, closingBreakdown, dynamicClosingItems, companyId, financeCategories]);

  const handleOpenFinanceShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Check if user already has an open POS or Finance session
    const existingSession = cashierSessions.find(s =>
      (s.userId === currentUser.id || s.user_id === currentUser.id) &&
      s.status === 'open'
    );

    if (existingSession) {
      alert("Você já possui um caixa aberto (PDV ou Financeiro). Feche-o antes de abrir outro.");
      return;
    }

    try {
      const balance = parseNumericString(financeOpeningBalance);
      const newSession: Partial<CashierSession> = {
        companyId: companyId!,
        company_id: companyId!,
        userId: currentUser.id,
        user_id: currentUser.id,
        userName: currentUser.name,
        user_name: currentUser.name,
        type: 'finance', // IMPORTANTE: Identifica como Caixa Financeiro
        status: 'open',
        openingTime: db.getNowISO(),
        opening_time: db.getNowISO(),
        openingBalance: balance,
        opening_balance: balance
      };

      const session = await db.insert<CashierSession>('cashierSessions', newSession);

      // Encontrar o termo de pagamento "DINHEIRO" ou "À VISTA" com 0 dias (Prioridade para DINHEIRO)
      const cashTerm = allPaymentTerms.find(t =>
        t.name?.toUpperCase().includes('DINHEIRO') && t.days === 0
      ) || allPaymentTerms.find(t =>
        t.name?.toUpperCase().includes('À VISTA') && t.days === 0
      ) || allPaymentTerms.find(t => t.days === 0);

      // 1. Criar Registro Financeiro de Abertura (Para aparecer no Histórico)
      await db.insert('financials', {
        company_id: companyId!,
        companyId: companyId!,
        user_id: currentUser.id,
        userId: currentUser.id,
        tipo: 'entrada',
        categoria: 'Abertura de Caixa',
        valor: balance,
        status: 'paid',
        description: `ABERTURA DE CAIXA - TURNO ${session.id.slice(0, 6).toUpperCase()}`,
        due_date: db.getToday(),
        dueDate: db.getToday(),
        caixa_id: session.id,
        caixaId: session.id,
        natureza: 'ENTRADA',
        liquidation_date: db.getNowISO(),
        liquidationDate: db.getNowISO(),
        payment_term_id: cashTerm?.id || cashTerm?.uuid || null,
        paymentTermId: cashTerm?.id || cashTerm?.uuid || null
      });

      // AUTOMATIC WALLET WITHDRAWAL (SAÍDA DA CARTEIRA)
      // If opening balance > 0, we must withdraw from "CARTEIRA" bank to fund the cashier
      if (balance > 0) {
        try {
          // 1. Find the "CARTEIRA" Partner or Bank to link (Optional, usually we just log to wallet_transactions)
          // Ideally we look for a bank named 'CARTEIRA' to get its ID, or just use a generic reference.
          // For now, we will just insert into wallet_transactions with category 'SAÍDA' and description.
          // IF we need to link to a Partner, we could look for 'CARTEIRA' partner?
          // Usually wallet_transactions has 'parceiro' as string name.

          const walletPayload: any = {
            company_id: companyId!,
            user_id: currentUser.id,
            valor_saida: balance,
            valor_entrada: 0,
            saldo_real: 0, // Will be calculated by trigger or backend usually, or ignored in UI
            categoria: 'TRANSFERÊNCIA',
            parceiro: 'CARTEIRA', // Origin
            descricao: 'TRANSFERÊNCIA P/ CAIXA FINANCEIRO (ABERTURA)',
            payment_term_id: null,
            operador_id: currentUser.id,
            operador_name: currentUser.name,
            created_at: db.getNowISO(),
            updated_at: db.getNowISO(),
            status: 'completed'
          };

          await db.insert('walletTransactions', walletPayload);
        } catch (wErr) {
          console.error("Failed to create wallet withdrawal for opening balance", wErr);
          // Non-blocking, but good to know
        }
      }

      setShowOpenShiftModal(false);
      setFinanceOpeningBalance('');
      alert("Caixa Financeiro aberto com sucesso! Transferência da Carteira realizada.");
      triggerRefresh();
    } catch (err: any) {
      alert("Erro ao abrir caixa: " + err.message);
    }
  };

  const handleCloseFinanceShift = () => {
    if (!activeFinanceSession) return;
    setClosingBreakdown({});
    setIsClosingModalOpen(true);
  };

  const handleFinalCloseFinanceShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFinanceSession) return;
    setIsClosingShift(true);

    try {
      const physical: Record<string, number> = {};
      dynamicClosingItems.forEach(item => { physical[item.id] = parseNumericString(closingBreakdown[item.id] || '0'); });
      const totalFisico = (physical['physical_cash'] || 0) + (physical['physical_check'] || 0);

      // Usar a mesma lógica de Valor Real da auditoria para persistir o esperado
      const sessionRecords = allFinancialRecords.filter(r => r.caixa_id === activeFinanceSession.id && r.status !== 'reversed' && r.categoria !== 'Abertura de Caixa');
      const cashIn = sessionRecords.filter(r => {
        const tId = r.payment_term_id || r.paymentTermId;
        const term = allPaymentTerms.find(t => t.id === tId || t.uuid === tId);
        return (term?.name.toUpperCase().includes('DINHEIRO') || term?.name === 'À VISTA') && r.natureza === 'ENTRADA';
      }).reduce((s, r) => s + r.valor, 0);
      const cashOut = sessionRecords.filter(r => {
        const tId = r.payment_term_id || r.paymentTermId;
        const term = allPaymentTerms.find(t => t.id === tId || t.uuid === tId);
        return (term?.name.toUpperCase().includes('DINHEIRO') || term?.name === 'À VISTA') && r.natureza === 'SAIDA';
      }).reduce((s, r) => s + r.valor, 0);
      const checkIn = sessionRecords.filter(r => {
        const tId = r.payment_term_id || r.paymentTermId;
        const term = allPaymentTerms.find(t => t.id === tId || t.uuid === tId);
        return term?.name.toUpperCase().includes('CHEQUE') && r.natureza === 'ENTRADA';
      }).reduce((s, r) => s + r.valor, 0);

      const opening = activeFinanceSession.openingBalance || activeFinanceSession.opening_balance || 0;
      const expectedTotal = opening + (cashIn + checkIn) - cashOut;

      await db.update<CashierSession>('cashierSessions', activeFinanceSession.id, {
        status: 'closed',
        closingBalance: totalFisico,
        expectedBalance: expectedTotal,
        difference: totalFisico - expectedTotal,
        closingTime: db.getNowISO(),
        physicalBreakdown: physical as any,
        closing_balance: totalFisico,
        expected_balance: expectedTotal,
        closing_time: db.getNowISO()
      });

      setActiveFinanceSession(null);
      setIsClosingModalOpen(false);
      alert("Turno Financeiro encerrado com sucesso! Aguardando conferência do gestor.");
      triggerRefresh();
    } catch (err: any) {
      alert("Erro ao encerrar turno: " + err.message);
    } finally {
      setIsClosingShift(false);
    }
  };

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
          handleFinalCloseFinanceShift(e as any);
        }
      }
    }
  };

  // NEW TITLE (MANUAL PAYABLE/RECEIVABLE) STATE
  const [showNewTitleModal, setShowNewTitleModal] = useState(false);
  const [newTitleForm, setNewTitleForm] = useState({
    natureza: 'SAIDA' as 'ENTRADA' | 'SAIDA',
    tipo: 'despesa' as 'despesa' | 'entrada' | 'pagamento', // Default to expense
    valor: '',
    categoria: '',
    parceiro: '',
    payment_term_id: '',
    vencimento: db.getToday(),
    descricao: ''
  });
  // New Partner Selection State
  const [isNewTitlePartnerMenuOpen, setIsNewTitlePartnerMenuOpen] = useState(false);
  const [newTitlePartnerSearch, setNewTitlePartnerSearch] = useState('');

  const handleCreateTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Validate
    if (!newTitleForm.valor || !newTitleForm.categoria || !newTitleForm.parceiro || !newTitleForm.descricao) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const amount = parseNumericString(newTitleForm.valor);
      const selectedTermId = newTitleForm.payment_term_id || null;
      const termObj = allPaymentTerms.find(t => t.id === selectedTermId || t.uuid === selectedTermId);
      const isAVista = termObj && (termObj.days === 0 || termObj.name?.toUpperCase().includes('À VISTA') || termObj.name?.toUpperCase().includes('DINHEIRO'));

      // Validação de Segurança: Títulos À VISTA exigem caixa aberto
      if (isAVista && !activeFinanceSession) {
        alert("Operações financeiras À VISTA (Dinheiro, Cheque, Pix) exigem um Turno Financeiro Aberto para serem registradas. Por favor, abra o caixa ou agende o título para A PRAZO.");
        return;
      }

      const payload: any = {
        company_id: companyId!,
        companyId: companyId!, // Include both cases for compatibility
        userId: currentUser.id,
        user_id: currentUser.id,
        tipo: newTitleForm.tipo,
        natureza: newTitleForm.natureza,
        categoria: newTitleForm.categoria,
        parceiro_id: newTitleForm.parceiro,
        parceiroId: newTitleForm.parceiro,
        valor: amount,
        description: newTitleForm.descricao.toUpperCase(),
        due_date: newTitleForm.vencimento,
        dueDate: newTitleForm.vencimento,
        status: isAVista ? 'paid' : 'pending',
        paymentMethod: isAVista ? 'À VISTA' : 'A PRAZO',
        payment_method: isAVista ? 'À VISTA' : 'A PRAZO',
        liquidation_date: isAVista ? db.getNowISO() : null,
        liquidationDate: isAVista ? db.getNowISO() : null,
        payment_term_id: selectedTermId,
        paymentTermId: selectedTermId,
        updated_at: db.getNowISO()
      };

      if ((newTitleForm as any).id) {
        // UPDATE: Agora pede AUTORIZAÇÃO antes de efetivar a alteração COM DETALHES
        payload.id = (newTitleForm as any).id;

        // Find original record to compare
        const original = allFinancialRecords.find(r => r.id === payload.id);
        const detailsParts = [];

        if (original) {
          if (original.valor !== payload.valor) {
            detailsParts.push(`Valor: DE R$ ${formatCurrency(original.valor)} PARA R$ ${formatCurrency(payload.valor)}`);
          }
          if (original.description !== payload.description) {
            detailsParts.push(`Desc: DE "${original.description}" PARA "${payload.description}"`);
          }
          if (original.due_date !== payload.due_date && original.dueDate !== payload.dueDate) {
            const oldDate = original.due_date || original.dueDate;
            detailsParts.push(`Venc: DE ${oldDate ? formatBRDate(oldDate) : 'N/A'} PARA ${formatBRDate(payload.due_date)}`);
          }
        }

        // Se mudou algo, usa o detalhe, senão texto genérico
        const detailString = detailsParts.length > 0 ? detailsParts.join(' | ') : `Alteração no Título ${payload.description}`;

        setPendingEditPayload({ ...payload, _authDetails: detailString }); // Attach details to payload for modal usage
        setIsRequestEditLiquidationAuthModalOpen(true);
        return;
      } else {
        // INSERT
        payload.created_at = db.getNowISO();
        // Link to Finance Session if open (Fixing previous issue)
        payload.caixaId = activeFinanceSession ? activeFinanceSession.id : null;
        payload.caixa_id = activeFinanceSession ? activeFinanceSession.id : null;

        await db.insert('financials', payload);
        alert("Título criado com sucesso!");
      }

      setShowNewTitleModal(false);
      setNewTitleForm({
        natureza: 'SAIDA',
        tipo: 'despesa',
        valor: '',
        categoria: '',
        parceiro: '',
        vencimento: db.getToday(),
        descricao: '',
        id: ''
      } as any);
      triggerRefresh();
    } catch (err: any) {
      alert("Erro ao salvar título: " + err.message);
    }
  };

  // DELETE TITLE (Soft Delete / Reverse)
  const handleDeleteTitle = async (record: FinancialRecord) => {
    // SEMPRE pede autorização para excluir no Hub Financeiro
    setRecordToDelete(record);
    setIsRequestDeleteLiquidationAuthModalOpen(true);
  };

  // EDIT TITLE (Open Modal with Data)
  const handleEditTitle = (record: FinancialRecord) => {
    // Agora abre o modal direto, e pede senha ao SALVAR (no handleCreateTitle)
    setRecordToEdit(record);
    setNewTitleForm({
      natureza: record.natureza || (record.tipo === 'despesa' ? 'SAIDA' : 'ENTRADA'),
      tipo: (record.tipo as any) || 'despesa',
      valor: record.valor.toFixed(2).replace('.', ','),
      categoria: record.categoria,
      parceiro: record.parceiro_id || '',
      payment_term_id: record.payment_term_id || record.paymentTermId || '',
      vencimento: record.dueDate || record.due_date || db.getToday(),
      descricao: record.description,
      id: record.id // Add ID for update logic
    } as any);
    setShowNewTitleModal(true);
  };

  // REVERSE LIQUIDATION (Status Paid -> Pending)
  const handleReverseLiquidation = (record: FinancialRecord) => {
    if (record.status !== 'paid' && !record.liquidation_date) {
      alert('Apenas títulos liquidados podem ser estornados.');
      return;
    }
    setRecordToReverse(record);
    setIsRequestReverseLiquidationAuthModalOpen(true);
  };

  const executeReverseLiquidation = async (record: FinancialRecord) => {
    try {
      // 1. Update the Financial Record
      await db.update('financials', record.id, {
        status: 'pending',
        liquidation_date: null,
        liquidationDate: null,
        caixa_id: null,
        caixaId: null,
        payment_term_id: null,
        paymentTermId: null,
        forma_pagamento: null,
        updated_at: db.getNowISO()
      });

      // 2. If it has a linked Transaction (PDV Sale/Purchase), update it too
      if (record.transaction_id || (record as any).transactionId) {
        const txId = record.transaction_id || (record as any).transactionId;
        try {
          await db.update('transactions', txId, {
            status: 'pending', // or 'processing' depending on how POS handles it
            updated_at: db.getNowISO()
          });
        } catch (txErr) {
          console.warn("Could not find/update linked transaction:", txId);
        }
      }

      await db.logAction(
        companyId,
        currentUser?.id || '',
        currentUser?.name || 'Sistema',
        'FINANCE_LIQUIDATION_REVERSAL',
        `OP: Estorno de Liquidação | CTX: Finance Hub | DET: Estornado título ID: ${record.id} | Desc: ${record.description} | Valor: R$ ${record.valor.toFixed(2)}`
      );

      alert('Liquidação estornada com sucesso! O título e o histórico foram atualizados.');

      // Force a re-fetch of everything
      triggerRefresh();
    } catch (err: any) {
      alert('Erro ao estornar: ' + err.message);
    }
  };

  const executeCommitEditTitle = async (payload: any) => {
    try {
      if (!payload.id) throw new Error("ID do título não encontrado no payload.");

      const titleId = payload.id;
      // Remove id from payload before update
      const { id, ...updateData } = payload;

      await db.update('financials', titleId, updateData);

      await db.logAction(
        companyId,
        currentUser?.id || '',
        currentUser?.name || 'Sistema',
        'FINANCE_TITLE_EDIT',
        `OP: Edição de Título | CTX: Finance Hub | DET: Atualizado título ID: ${titleId} | Desc: ${payload.description} | Valor: R$ ${payload.valor.toFixed(2)}`
      );

      alert("Título atualizado com sucesso!");
      setShowNewTitleModal(false);
      setNewTitleForm({
        natureza: 'SAIDA',
        tipo: 'despesa',
        valor: '',
        categoria: '',
        parceiro: '',
        vencimento: db.getToday(),
        descricao: '',
        id: ''
      } as any);
      triggerRefresh();
    } catch (err: any) {
      alert("Erro ao salvar atualização: " + err.message);
    }
  };

  const executeDeleteTitle = async (record: FinancialRecord) => {
    try {
      await db.update('financials', record.id, {
        status: 'reversed',
        is_reversed: true,
        updated_at: db.getNowISO()
      });

      await db.logAction(
        companyId,
        currentUser?.id || '',
        currentUser?.name || 'Sistema',
        'FINANCE_TITLE_DELETE',
        `OP: Exclusão de Título | CTX: Finance Hub | DET: Excluído título ID: ${record.id} | Desc: ${record.description} | Valor: R$ ${record.valor.toFixed(2)}`
      );

      alert('Título excluído com sucesso!');
      triggerRefresh();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const client = db.getCloudClient();

    try {
      const allPartners = db.queryTenant<Partner>('partners', companyId);

      // FILTRagem RIGOROSA DE TERMOS PARA O HUB (POLÍTICA ENTERPRISE)
      const allTermsRaw = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);

      const pTerms = allTermsRaw.filter((t: PaymentTerm) =>
      ((t.show_in_settle === true || (t as any).showInSettle === true || t.show_in_title_launch === true || (t as any).showInTitleLaunch === true) &&
        (t.show_in_purchase === true || (t as any).showInPurchase === true))
      );

      const sTerms = allTermsRaw.filter((t: PaymentTerm) =>
      ((t.show_in_settle === true || (t as any).showInSettle === true || t.show_in_title_launch === true || (t as any).showInTitleLaunch === true) &&
        (t.show_in_sale === true || (t as any).showInSale === true))
      );

      // Termos permitidos para o Hub (Extrato/Geral)
      const hTerms = allTermsRaw.filter((t: PaymentTerm) =>
      (t.show_in_settle === true || (t as any).showInSettle === true ||
        t.show_in_bank_manual === true || (t as any).showInBankManual === true)
      );

      // Termos ESPECÍFICOS para Lançamento Bancário Manual (Pedido do Usuário)
      const bManualTerms = allTermsRaw.filter((t: PaymentTerm) =>
        (t.show_in_bank_manual === true || (t as any).showInBankManual === true)
      );

      const allBanks = db.queryTenant<Bank>('banks', companyId);
      const allCategories = db.queryTenant<FinanceCategory>('financeCategories', companyId, () => true);
      const users = db.queryTenant<User>('users', companyId);

      setPartners(allPartners);
      setPurchasePaymentTerms(pTerms);
      setSalePaymentTerms(sTerms);
      setAllHubTerms(hTerms);
      setAllPaymentTerms(allTermsRaw);
      setBankManualTerms(bManualTerms);
      setBanks(allBanks);
      setFinanceCategories(allCategories);
      setTeamUsers(users);

      if (client && companyId) {
        try {
          const { data: finData, error: finError } = await client.from('financials').select('*').eq('company_id', companyId);
          if (finError) throw finError;
          if (finData) setAllFinancialRecords(finData.map(db.normalize));

          const { data: walletData, error: walletError } = await client.from('wallet_transactions').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
          if (walletError) throw walletError;
          if (walletData) setWalletTransactions(walletData.map(db.normalize));

          const { data: sessionData, error: sessionError } = await client.from('cashier_sessions').select('*').eq('company_id', companyId).order('opening_time', { ascending: false });
          if (sessionError) throw sessionError;
          if (sessionData) {
            const normSessions = sessionData.map(db.normalize);
            setCashierSessions(normSessions);
            const myActive = normSessions.find(s => (s.userId === currentUser?.id || s.user_id === currentUser?.id) && s.status === 'open');
            setActiveSession(myActive || null);

            // Sets Active Finance Session if matches type
            if (myActive && myActive.type === 'finance') {
              setActiveFinanceSession(myActive);
            } else {
              setActiveFinanceSession(null);
            }
          }
        } catch (fetchErr: any) {
          console.warn("Supabase fetch failed (Network/Auth), falling back to local storage:", fetchErr.message);
          // Fallback to local data
          setAllFinancialRecords(db.queryTenant<FinancialRecord>('financials', companyId));
          setWalletTransactions(db.queryTenant<WalletTransaction>('walletTransactions' as any, companyId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          const sessions = db.queryTenant<CashierSession>('cashierSessions', companyId);
          setCashierSessions(sessions);
          const myActive = sessions.find(s => (s.userId === currentUser?.id || s.user_id === currentUser?.id) && s.status === 'open');
          setActiveSession(myActive || null);
          setActiveFinanceSession(myActive?.type === 'finance' ? myActive : null);
        }
      } else {
        setAllFinancialRecords(db.queryTenant<FinancialRecord>('financials', companyId));
        setWalletTransactions(db.queryTenant<WalletTransaction>('walletTransactions' as any, companyId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        const sessions = db.queryTenant<CashierSession>('cashierSessions', companyId);
        setCashierSessions(sessions);
        const myActive = sessions.find(s => (s.userId === currentUser?.id || s.user_id === currentUser?.id) && s.status === 'open');
        setActiveSession(myActive || null);

        // Sets Active Finance Session if matches type
        if (myActive && myActive.type === 'finance') {
          setActiveFinanceSession(myActive);
        } else {
          setActiveFinanceSession(null);
        }
      }
    } catch (err: any) {
      console.error("Erro fatal ao sincronizar Hub Financeiro:", err.message || err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, currentUser, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  // Process Approved Authorization Requests
  useEffect(() => {
    if (!currentUser || !pendingRequests) return;

    const approvedAndMine = pendingRequests.filter(r =>
      r.status === 'APPROVED' &&
      r.requested_by_id === currentUser.id &&
      !processedAuthIds.current.has(r.id)
    );

    if (approvedAndMine.length > 0) {
      approvedAndMine.forEach(async (req) => {
        processedAuthIds.current.add(req.id);
        try {
          if (req.action_key === 'CANCELAR_TRANSACAO_CARTEIRA') {
            const txId = req.action_label.split('ID: ')[1];
            executeDeleteTransaction(txId);
          } else if (req.action_key === 'LANCAMENTO_MANUAL_CARTEIRA') {
            const jsonPart = req.action_label.split('JSON: ')[1];
            if (jsonPart) {
              const data = JSON.parse(jsonPart);
              executeWalletManualSubmit(data);
            }
          } else if (req.action_key === 'ESTORNAR_TRANSACAO_CARTEIRA') {
            const txId = req.action_label.split('ID: ')[1];
            const tx = walletTransactions.find(t => t.id === txId || t.uuid === txId);
            if (tx) executeReverseSystemTransaction(tx);
          } else if (req.action_key === 'ESTORNAR_LIQUIDACAO') {
            const match = req.action_label.match(/ID: ([a-f0-9-]+)/i);
            if (match && match[1]) {
              const record = allFinancialRecords.find(f => f.id === match[1]);
              if (record) {
                executeReverseLiquidation(record);
              } else {
                console.error("ESTORNAR_LIQUIDACAO: Título não encontrado no estado local:", match[1]);
              }
            }
          } else if (req.action_key === 'ESTORNAR_AUDITORIA') {
            const match = req.action_label.match(/TURNO: ([a-f0-9-]+)/i);
            if (match && match[1]) {
              const session = cashierSessions.find(s => s.id === match[1]);
              if (session) {
                executeReverseAudit(session, req.responded_by_id!, req.responded_by_name!);
              } else {
                console.error("ESTORNAR_AUDITORIA: Sessão não encontrada:", match[1]);
              }
            }
          } else if (req.action_key === 'SALVAR_EDICAO_FINANCEIRO') {
            const jsonPart = req.action_label.split('JSON: ')[1];
            if (jsonPart) {
              const data = JSON.parse(jsonPart);
              executeCommitEditTitle(data);
            }
          } else if (req.action_key === 'EXCLUIR_LIQUIDACAO') {
            const match = req.action_label.match(/ID: ([a-f0-9-]+)/i);
            if (match && match[1]) {
              const record = allFinancialRecords.find(f => f.id === match[1]);
              if (record) {
                executeDeleteTitle(record);
              } else {
                console.error("EXCLUIR_LIQUIDACAO: Título não encontrado no estado local:", match[1]);
              }
            }
          }
          // Mark as PROCESSED to avoid re-triggering
          await db.update('authorization_requests' as any, req.id, { status: 'PROCESSED' } as any);
          refreshRequests();
        } catch (e) { console.error("Error processing auth request", e); }
      });
    }
  }, [pendingRequests, currentUser, walletTransactions, allFinancialRecords]);

  // Realtime Subscriptions for Auto-Refresh
  useEffect(() => {
    const client = db.getCloudClient();
    if (!client || !companyId) return;

    const channel = client.channel(`finance_hub_changes_${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cashier_sessions', filter: `company_id=eq.${companyId}` },
        () => {
          console.log('Realtime: cashier_sessions updated, refreshing...');
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financials', filter: `company_id=eq.${companyId}` },
        () => {
          console.log('Realtime: financials updated, refreshing...');
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `company_id=eq.${companyId}` },
        () => {
          console.log('Realtime: wallet_transactions updated, refreshing...');
          triggerRefresh();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [companyId]);

  // Safety Net: Polling every 10 seconds to ensure consistency
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Polling: Auto-refreshing FinanceHub data...");
      triggerRefresh();
    }, 10000);

    const handleFocus = () => {
      console.log("Window Focus: Refreshing FinanceHub...");
      triggerRefresh();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);



  const filteredWallet = useMemo(() => {
    return walletTransactions.filter(t => {
      const tDate = getBRDateOnly(t.created_at || '');
      const matchDate = tDate >= dateStart && tDate <= dateEnd;
      const matchesSearch = t.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBanco = !walletFilterBanco || t.parceiro.toLowerCase().includes(walletFilterBanco.toLowerCase());
      const matchesForma = !walletFilterForma || t.payment_term_id === walletFilterForma;
      return matchDate && matchesSearch && matchesBanco && matchesForma;
    });
  }, [walletTransactions, searchTerm, dateStart, dateEnd, walletFilterBanco, walletFilterForma]);

  const filteredItems = useMemo(() => {
    return allFinancialRecords.filter(r => {
      const status = getStatusInfo(r);
      if (status.label === 'LIQUIDADO' || status.label === 'CANCELADO' || status.label === 'PENDENTE') return false;
      const rDate = getBRDateOnly(r.dueDate || r.due_date || r.created_at || '');
      const matchDate = rDate >= dateStart && rDate <= dateEnd;
      if (!matchDate) return false;

      const partner = partners.find(p => p.id === r.parceiro_id);
      const searchNormalized = normalizeText(searchTerm);

      const matchesSearch =
        normalizeText(r.description).includes(searchNormalized) ||
        normalizeText(partner?.name || '').includes(searchNormalized);

      const matchesType = filterType === 'ALL' || r.natureza === filterType;

      const matchesSession = !filterSession || normalizeText(r.caixa_id || '').includes(normalizeText(filterSession));
      const matchesStatus = !filterStatus || normalizeText(status.label) === normalizeText(filterStatus);
      const matchesPartner = !filterPartner || normalizeText(partner?.name || '').includes(normalizeText(filterPartner));

      return matchesSearch && matchesType && matchesSession && matchesStatus && matchesPartner;
    });
  }, [allFinancialRecords, filterType, dateStart, dateEnd, searchTerm, partners, filterSession, filterStatus, filterPartner]);

  const baixasMetrics = useMemo(() => {
    const metrics = { abertoIn: 0, abertoOut: 0, atrasadoIn: 0, atrasadoOut: 0 };
    filteredItems.forEach(item => {
      const info = getStatusInfo(item);
      if (info.label === 'ABERTO') {
        if (item.natureza === 'ENTRADA') metrics.abertoIn += item.valor;
        else metrics.atrasadoOut += item.valor;
      } else if (info.label === 'ATRASADO') {
        if (item.natureza === 'ENTRADA') metrics.atrasadoIn += item.valor;
        else metrics.atrasadoOut += item.valor;
      }
    });
    return metrics;
  }, [filteredItems]);

  const filteredSessions = useMemo(() => {
    return cashierSessions.filter(s => {
      const sDate = getBRDateOnly(s.openingTime || s.opening_time || '');
      const matchDate = sDate >= auditDateStart && sDate <= auditDateEnd;
      const matchOperator = auditOperatorFilter === 'all' || s.userId === auditOperatorFilter || s.user_id === auditOperatorFilter;
      const matchAuditor = auditAuditorFilter === 'all' || s.reconciledById === auditAuditorFilter || (s as any).reconciled_by_id === auditAuditorFilter;
      const matchSessionId = !auditFilterSessionId || (s.id || '').toLowerCase().includes(auditFilterSessionId.toLowerCase());
      const matchStatus = auditFilterStatus === 'all' || s.status === auditFilterStatus;

      return matchDate && matchOperator && matchAuditor && matchSessionId && matchStatus;
    });
  }, [cashierSessions, auditDateStart, auditDateEnd, auditOperatorFilter, auditAuditorFilter, auditFilterSessionId, auditFilterStatus]);

  const sessionBaixas = useMemo(() => {
    if (!activeFinanceSession) return [];
    // Show ALL records linked to this session (both Liquidations and new Provisions)
    return allFinancialRecords.filter(r =>
      r.caixa_id === activeFinanceSession.id
    ).sort((a, b) => {
      const timeA = new Date(a.liquidation_date || a.created_at).getTime();
      const timeB = new Date(b.liquidation_date || b.created_at).getTime();
      return timeB - timeA;
    });
  }, [allFinancialRecords, activeFinanceSession]);

  /**
   * @google/genai Senior Frontend Engineer: 
   * Filtro de categorias para lançamento manual bancário.
   * Só exibe categorias marcadas como "show_in_bank_manual" E que batam com a natureza (In/Out/Both).
   */
  const filteredWalletCategories = useMemo(() => {
    const targetFlow = walletForm.tipo === 'ENTRADA' ? 'in' : 'out';
    return financeCategories.filter(c => {
      // Regra de Negócio: Trazer apenas as marcadas no contexto bancário
      const isMarkedForBank = c.show_in_bank_manual === true || (c as any).showInBankManual === true;
      if (!isMarkedForBank) return false;

      // Mantém integridade do fluxo In/Out
      return c.type === 'both' || c.type === targetFlow;
    });
  }, [financeCategories, walletForm.tipo]);

  /**
   * @google/genai Senior Frontend Engineer:
   * Gera dinamicamente os campos de auditoria baseados nas transações reais do turno.
   * Espelha a lógica do POS.tsx para consistência UX.
   */
  const auditItems = useMemo(() => {
    const session = auditModal.session;
    if (!session) return [];

    const items: { id: string, label: string, group: 'ENTRADA' | 'SAIDA' | 'FISICO' | 'ENTRADA_INFO' | 'SAIDA_INFO', icon: any }[] = [];

    // GRUPO FISICO (Mantém inalterado - sempre presente)
    items.push({ id: 'physical_cash', label: 'DINHEIRO EM MÃOS', group: 'FISICO', icon: Banknote });
    items.push({ id: 'physical_check', label: 'CHEQUE EM MÃOS', group: 'FISICO', icon: Coins });

    // Buscar todos os registros financeiros deste turno
    const shiftRecords = db.queryTenant<FinancialRecord>('financials', companyId, f => f.caixa_id === session.id);

    // Categorias excluídas
    const excludedCategories = ['Compra de Materiais', 'Venda de Materiais'];

    // Processar categorias únicas por natureza
    const categoryMap = new Map<string, { natureza: string, total: number }>();

    shiftRecords.forEach(rec => {
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
      const term = allPaymentTerms.find(t => t.id === termId || t.uuid === termId);

      if (!term) return;
      const termName = term.name || '';
      if (termName === 'À VISTA (DINHEIRO)' || termName === 'À VISTA' || termName.toUpperCase().includes('CHEQUE')) return;

      const key = `term_${termName}_${rec.natureza}`;
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
        label: (categoria || '').toUpperCase(),
        group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO',
        icon: value.natureza === 'ENTRADA' ? ArrowUpCircle : ArrowDownCircle
      });
    });

    // Adicionar payment terms ao array de items
    termMap.forEach((value, key) => {
      const termName = key.replace(`term_`, '').replace(`_${value.natureza}`, '');
      items.push({
        id: key,
        label: `${(termName || '').toUpperCase()}`,
        group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO',
        icon: CreditCard
      });
    });

    return items;
  }, [auditModal.session, companyId, allPaymentTerms]);

  const executeWalletManualSubmit = async (data: any) => {
    try {
      const amount = parseNumericString(data.valor);
      const isEntry = data.tipo === 'ENTRADA';

      // Se for EDIÇÃO (tem data.id), usamos db.update ao invés de insert+delete
      if (data.id) {
        await db.update('walletTransactions', data.id, {
          categoria: data.categoria,
          parceiro: data.parceiro,
          payment_term_id: data.payment_term_id,
          descricao: data.descricao.toUpperCase(),
          valor_entrada: isEntry ? amount : 0,
          valor_saida: isEntry ? 0 : amount,
          updated_at: db.getNowISO()
        });
        console.log("[WALLET] Edição realizada via update no ID:", data.id);
      } else {
        // Se for NOVO LANÇAMENTO
        // Removemos a trava obrigatória de activeFinanceSession para permitir que gestores lancem direto no extrato
        const opId = activeFinanceSession?.userId || activeFinanceSession?.user_id || currentUser?.id;
        const opName = activeFinanceSession?.userName || activeFinanceSession?.user_name || currentUser?.name || 'Sistema';

        await db.insert<WalletTransaction>('walletTransactions' as any, {
          company_id: companyId!,
          user_id: currentUser?.id,
          categoria: data.categoria,
          parceiro: data.parceiro,
          payment_term_id: data.payment_term_id,
          descricao: data.descricao.toUpperCase() || `LANÇAMENTO MANUAL ${data.tipo}`,
          valor_entrada: isEntry ? amount : 0,
          valor_saida: isEntry ? 0 : amount,
          saldo_real: 0, // Será recomputado dinamicamente na view
          created_at: db.getNowISO(),
          operador_id: opId,
          operador_name: opName
        });
        console.log("[WALLET] Novo lançamento inserido.");
      }

      setShowWalletManualEntry(false);
      setWalletForm({ tipo: 'ENTRADA', valor: '', categoria: '', parceiro: '', payment_term_id: '', descricao: '', id: '' });
      triggerRefresh();
    } catch (err: any) {
      console.error("Erro ao efetivar lançamento:", err);
      alert("Erro ao efetivar lançamento: " + err.message);
    }
  };

  const handleWalletManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumericString(walletForm.valor);
    if (isNaN(amount) || amount <= 0) return alert("Informe um valor válido.");
    if (!walletForm.payment_term_id) return alert("Selecione um Meio de Pagamento.");

    if (walletForm.tipo === 'SAIDA') {
      const selectedBankId = walletForm.parceiro;
      const currentBankBalance = walletTransactions
        .filter(t => t.parceiro === selectedBankId && t.status !== 'cancelled')
        .reduce((acc, t) => acc + (t.valor_entrada || 0) - (t.valor_saida || 0), 0);

      if (amount > currentBankBalance + 0.01) {
        return alert(`Saldo insuficiente na conta selecionada.\nSaldo Atual: R$ ${formatCurrency(currentBankBalance)}`);
      }
    }

    setManualEntryToAuthorize(walletForm);
    setIsRequestManualAuthModalOpen(true);
  };

  const executeDeleteTransaction = async (id: string) => {
    try {
      await db.update('walletTransactions', id, { status: 'cancelled' });
      triggerRefresh();
    } catch (err: any) {
      alert("Erro ao cancelar: " + err.message);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const t = walletTransactions.find(wt => (wt.id === id || wt.uuid === id));
    if (!t) return;
    setTxToAuthorize(t);
    setIsRequestDeleteAuthModalOpen(true);
  };

  const handleEditTransaction = (t: WalletTransaction) => {
    const isEntry = t.valor_entrada > 0;
    setWalletForm({
      id: t.id,
      tipo: isEntry ? 'ENTRADA' : 'SAIDA',
      valor: formatCurrency(isEntry ? t.valor_entrada : t.valor_saida),
      categoria: t.categoria || '',
      parceiro: t.parceiro || '',
      payment_term_id: t.payment_term_id || '',
      descricao: t.descricao || ''
    });
    setShowWalletManualEntry(true);
  };

  const handleProcessLiquidation = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for Finance Shift specifically
    if (!activeFinanceSession) {
      alert("É necessário abrir o Caixa Financeiro para liquidar títulos.");
      return;
    }

    if (!liquidationModal.record || isLiquidating) return;
    setIsLiquidating(true);
    try {
      await db.update('financials', liquidationModal.record.id, {
        status: 'paid',
        paymentTermId: liquidationModal.termId,
        liquidation_date: db.getNowISO(),
        due_date: liquidationModal.dueDate,
        caixa_id: activeFinanceSession.id // Use Finance Session ID
      });
      setLiquidationModal({ show: false, record: null, termId: '', dueDate: '', receivedValue: '' });
      triggerRefresh();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setIsLiquidating(false);
    }
  };
  /**
   * @google/genai Senior Frontend Engineer: 
   * Lógica de Conferência de Turno e Depósito Master com separação financeira rígida.
   * Apura Dinheiro e Cheque individualmente para rastreabilidade bancária total.
   * CORREÇÃO: Utiliza busca dinâmica de Meios de Pagamento para evitar IDs legados inexistentes no banco.
   */
  const handleProcessReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    const { session, bankNameCash, bankNameCheck, auditedBreakdown } = auditModal;

    if (!session) return;

    const valVista = parseNumericString(auditedBreakdown['physical_cash'] || '0');
    const valCheque = parseNumericString(auditedBreakdown['physical_check'] || '0');

    if (valVista > 0 && !bankNameCash) return alert("Selecione a conta de destino para o DINHEIRO.");
    if (valCheque > 0 && !bankNameCheck) return alert("Selecione a conta de destino para o CHEQUE.");

    setIsAuditing(true);
    try {
      const auditedTotal = valVista + valCheque;

      let runningBalance = walletTransactions[0]?.saldo_real || 0;
      const now = db.getNowISO();

      // Busca dinamicamente os termos de pagamento para garantir classificação correta no banco
      const termDinheiro = allHubTerms.find(t => (t.name || '').toUpperCase().includes('DINHEIRO'));
      const termCheque = allHubTerms.find(t => (t.name || '').toUpperCase().includes('CHEQUE'));

      // Fallback para NULL se não encontrar o termo (evita erro de FK com UUIDs falsos)
      const idDinheiro = termDinheiro?.id || termDinheiro?.uuid || null;
      const idCheque = termCheque?.id || termCheque?.uuid || null;

      // 1. Atualizar o status da sessão para conferido
      await db.update('cashierSessions', session.id, {
        status: 'reconciled',
        reconciledAt: now,
        reconciledById: currentUser?.id,
        reconciled_by_id: currentUser?.id,
        reconciledByName: currentUser?.name,
        reconciled_by_name: currentUser?.name,
        reconciledBalance: auditedTotal,
        reconciledBreakdown: auditedBreakdown
      });

      // 2. Lançamento individual para DINHEIRO (se houver valor informado)
      if (valVista > 0) {
        await db.insert<WalletTransaction>('walletTransactions' as any, {
          company_id: companyId!,
          user_id: currentUser?.id,
          operador_id: session.user_id || session.userId,
          operador_name: session.user_name || session.userName,
          categoria: 'CONFERÊNCIA DE CAIXA',
          parceiro: bankNameCash,
          payment_term_id: idDinheiro,
          descricao: `DEPÓSITO MASTER [DINHEIRO] - TURNO #${session.id.slice(0, 6).toUpperCase()}`,
          valor_entrada: valVista,
          valor_saida: 0,
          saldo_real: runningBalance + valVista,
          created_at: now
        });
        runningBalance += valVista;
      }

      // 3. Lançamento individual para CHEQUE (se houver valor informado)
      if (valCheque > 0) {
        await db.insert<WalletTransaction>('walletTransactions' as any, {
          company_id: companyId!,
          user_id: currentUser?.id,
          operador_id: session.user_id || session.userId,
          operador_name: session.user_name || session.userName,
          categoria: 'CONFERÊNCIA DE CAIXA',
          parceiro: bankNameCheck,
          payment_term_id: idCheque,
          descricao: `DEPÓSITO MASTER [CHEQUE] - TURNO #${session.id.slice(0, 6).toUpperCase()}`,
          valor_entrada: valCheque,
          valor_saida: 0,
          saldo_real: runningBalance + valCheque,
          created_at: now
        });
      }

      // 4. Fallback: Log de auditoria para turno sem saldo físico
      if (valVista === 0 && valCheque === 0) {
        await db.insert<WalletTransaction>('walletTransactions' as any, {
          company_id: companyId!,
          user_id: currentUser?.id,
          operador_id: session.user_id || session.userId,
          operador_name: session.user_name || session.userName,
          categoria: 'CONFERÊNCIA DE CAIXA',
          parceiro: bankNameCash,
          payment_term_id: idDinheiro,
          descricao: `RECONCILIAÇÃO (SEM SALDO FÍSICO) - TURNO #${session.id.slice(0, 6).toUpperCase()}`,
          valor_entrada: 0,
          valor_saida: 0,
          saldo_real: runningBalance,
          created_at: now
        });
      }

      // 5. Registro de Auditoria do Turno no Histórico Narrativo de Segurança
      await db.logAction(
        companyId,
        currentUser?.id || '',
        currentUser?.name || 'Sistema',
        'AUDIT_MASTER_RECONCILIATION',
        `OP: Auditoria do Turno Concluída | CTX: Hub Financeiro | DET: Reconciliação do turno #${session.id.slice(0, 6).toUpperCase()} do operador ${session.user_name || session.userName}. Dinheiro: R$ ${valVista.toFixed(2)} -> ${bankNameCash}, Cheque: R$ ${valCheque.toFixed(2)} -> ${bankNameCheck}, Total Auditado: R$ ${auditedTotal.toFixed(2)}.`
      );

      setAuditModal({ show: false, session: null, bankNameCash: '', bankNameCheck: '', auditedBreakdown: {} });
      triggerRefresh();
      alert("Auditoria finalizada. Valores depositados separadamente por meio de pagamento.");
    } catch (err: any) {
      alert("Falha no DepÃ³sito Master: " + (err.message || err));
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRequestReverseReconciliation = async () => {
    const { session } = auditModal;
    setAuditToReverse(session);
    setAuditModal({ show: false, session: null, bankNameCash: '', bankNameCheck: '', auditedBreakdown: {}, readOnly: false });
    setIsRequestReverseAuditAuthModalOpen(true);
  };

  const executeReverseAudit = async (session: CashierSession, authId: string, authName: string) => {
    if (!session) return;

    setIsAuditing(true);
    try {
      // 1. Reverter Status da Sessão
      await db.update('cashierSessions', session.id, {
        status: 'closed', // Voltar para fechado (aguardando conferência)
        reconciledAt: null,
        reconciledById: null,
        reconciled_by_id: null,
        reconciledByName: null,
        reconciled_by_name: null,
        reconciledBalance: null,
        reconciledBreakdown: null
      });

      // 2. Excluir lançamentos financeiros gerados (Soft Delete ou Delete Real)
      // Buscamos pela descrição padrão gerada contendo o ID do turno
      const termoBusca = `TURNO #${session.id.slice(0, 6).toUpperCase()}`;

      const transactionsToDelete = walletTransactions.filter(t =>
        t.categoria === 'CONFERÊNCIA DE CAIXA' &&
        t.descricao.includes(termoBusca)
      );

      for (const t of transactionsToDelete) {
        await db.update('walletTransactions', t.id || t.uuid, { status: 'cancelled' });
      }

      // 3. Logar Ação de Auditoria (Reversão)
      await db.logAction(
        companyId,
        authId,
        authName,
        'AUDIT_MASTER_REVERSAL',
        `OP: Reversão de Auditoria | CTX: Hub Financeiro | DET: Reversão autorizada por ${authName} para o turno #${session.id.slice(0, 6).toUpperCase()}.`
      );

      alert("Conferência estornada com sucesso! O turno está disponível para nova conferência.");
      setAuditModal({ show: false, session: null, bankNameCash: '', bankNameCheck: '', auditedBreakdown: {} });
      triggerRefresh();
    } catch (err: any) {
      alert("Erro ao estornar: " + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const executeReverseSystemTransaction = async (t: WalletTransaction) => {
    const isSystem = t.categoria === 'CONFERÊNCIA DE CAIXA' || t.categoria === 'CONFERÃŠNCIA DE CAIXA' || t.descricao.includes('TURNO #');

    if (isSystem) {
      const match = t.descricao.match(/TURNO #([A-Z0-9]+)/);
      if (match && match[1]) {
        const shortId = match[1];
        // Buscar session pelo match parcial do ID (shortId)
        const sessions = await db.query<CashierSession>('cashierSessions');
        const session = sessions.find(s => s.id.toUpperCase().startsWith(shortId));

        if (session) {
          try {
            await db.update('cashierSessions', session.id, {
              status: 'closed',
              reconciledAt: null,
              reconciledBalance: null,
              reconciledBreakdown: null
            });
            const termoBusca = `TURNO #${shortId}`;
            const transactions = walletTransactions.filter(wt => wt.descricao.includes(termoBusca));
            for (const trans of transactions) {
              await db.update('walletTransactions', trans.id || trans.uuid, { status: 'cancelled' });
            }
            alert("Estorno realizado com sucesso! O turno foi reaberto para conferência.");
            triggerRefresh();
          } catch (err: any) {
            alert("Erro ao estornar: " + err.message);
          }
        } else {
          alert("Não foi possível localizar o turno de origem automaticamente.");
        }
      }
    } else {
      alert("Estorno automático não disponível para este tipo de lançamento.");
    }
  };

  const handleReverseSystemTransaction = (t: WalletTransaction) => {
    setTxToAuthorize(t);
    setIsRequestReverseAuthModalOpen(true);
  };

  const stats = useMemo(() => {
    // Calcular saldo dinâmico somando Entradas - Saídas (ignorando cancelados)
    const currentBalance = walletTransactions
      .filter(t => t.status !== 'cancelled')
      .reduce((acc, t) => acc + (t.valor_entrada || 0) - (t.valor_saida || 0), 0);
    return { currentWalletBalance: currentBalance };
  }, [walletTransactions]);

  const dynamicWalletData = useMemo(() => {
    // 1. Sort Ascending (Oldest First) to calculate running balance
    let sorted = [...walletTransactions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 2. Filter by Bank First (Scope for Balance)
    if (walletFilterBanco) {
      sorted = sorted.filter(t => t.parceiro === walletFilterBanco);
    }

    // 3. Calculate Running Balance
    let runningBalance = 0;
    const computed = sorted.map(t => {
      if (t.status !== 'cancelled') {
        runningBalance += (t.valor_entrada || 0) - (t.valor_saida || 0);
      }
      return { ...t, computedBalance: runningBalance };
    });

    // 4. Apply View Filters (Search, Operator, Date)
    let filtered = computed;

    // Date Filter (Applied here so table respects it)
    filtered = filtered.filter(t => {
      const tDate = getBRDateOnly(t.created_at || '');
      return tDate >= dateStart && tDate <= dateEnd;
    });

    if (searchTerm) {
      const lower = normalizeText(searchTerm);
      filtered = filtered.filter(t =>
        normalizeText(t.descricao || '').includes(lower) ||
        normalizeText(t.parceiro || '').includes(lower) ||
        normalizeText(t.operador_name || '').includes(lower) ||
        normalizeText(t.forma || '').includes(lower)
      );
    }

    if (walletFilterOperator && walletFilterOperator !== 'all') {
      filtered = filtered.filter(t => t.user_id === walletFilterOperator || (t as any).userId === walletFilterOperator);
    }

    // 5. Reverse for Display (Newest First)
    return filtered.reverse();
  }, [walletTransactions, walletFilterBanco, searchTerm, dateStart, dateEnd, walletFilterOperator]);

  const walletMetrics = useMemo(() => {
    // dynamicWalletData is now ALREADY filtered by date, so we just use it directly
    const inPeriod = dynamicWalletData;

    let totalEntrada = 0;
    let totalSaida = 0;

    inPeriod.forEach(t => {
      if (t.status !== 'cancelled') {
        totalEntrada += (t.valor_entrada || 0);
        totalSaida += (t.valor_saida || 0);
      }
    });

    // Saldo Final: Take from the NEWEST transaction in the period (index 0 because dynamicWalletData is reversed)
    // OR if no transactions, it's tricky. Let's show the balance of the LAST transaction if exists.
    const finalBalance = inPeriod.length > 0 ? inPeriod[0].computedBalance : 0; // Fallback to 0 or handle logic better later if needed.

    return { totalEntrada, totalSaida, result: totalEntrada - totalSaida, finalBalance: inPeriod.length > 0 ? finalBalance : null };
  }, [dynamicWalletData, dateStart, dateEnd]);

  const menuItems = [
    {
      id: 'baixas',
      label: 'Liquidação de Títulos',
      description: 'Gestão de contas a pagar e receber',
      icon: ListChecks,
      color: 'green',
      permission: PermissionModule.FINANCE_LIQUIDATE
    },
    {
      id: 'conferencia',
      label: 'Auditoria de Turnos',
      description: 'Conferência física e depósito master',
      icon: ShieldCheck,
      color: 'yellow',
      permission: PermissionModule.FINANCE_AUDIT
    },
    {
      id: 'carteira',
      label: 'Extrato Bancário',
      description: 'Fluxo de caixa e saldos reais cloud',
      icon: Landmark,
      color: 'blue',
      permission: PermissionModule.FINANCE_EXTRACT
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'border-t-brand-success shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)] hover:bg-gradient-to-b from-brand-success/10 to-transparent';
      case 'blue': return 'border-t-blue-500 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)] hover:bg-gradient-to-b from-blue-500/10 to-transparent';
      case 'yellow': return 'border-t-brand-warning shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)] hover:bg-gradient-to-b from-brand-warning/10 to-transparent';
      default: return 'border-t-slate-800';
    }
  };



  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      {!activeModal && (
        <header className="flex flex-col md:flex-row md:justify-between items-start md:items-center px-1 gap-4 md:gap-0">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Wallet className="text-brand-success" size={28} /> Hub Financeiro
            </h1>
            <p className="text-slate-400 text-[10px] md:text-sm mt-1 font-medium uppercase tracking-widest leading-relaxed">Movimentações operacionais e liquidez cloud.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {activeFinanceSession ? (
              <button
                onClick={handleCloseFinanceShift}
                className="px-4 py-2 bg-brand-warning/10 text-brand-warning border border-brand-warning/30 hover:bg-brand-warning/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all"
              >
                <ShieldCheck size={16} /> Fechar Caixa Financeiro #{activeFinanceSession.id.slice(0, 6).toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => setShowOpenShiftModal(true)}
                className="px-4 py-2 bg-brand-success/10 text-brand-success border border-brand-success/30 hover:bg-brand-success/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all"
              >
                <Zap size={16} /> Abrir Caixa Financeiro
              </button>
            )}

            {activeFinanceSession && (
              <div className="px-3 py-1.5 bg-brand-success/10 border border-brand-success/20 rounded-lg flex flex-col items-end">
                <span className="text-[8px] font-black text-brand-success uppercase tracking-widest">Turno Ativo</span>
                <span className="text-[10px] font-bold text-white">#{activeFinanceSession.id.slice(0, 6).toUpperCase()}</span>
              </div>
            )}

            <div className="enterprise-card px-4 py-2 flex items-center gap-3 border-slate-800 bg-slate-900/50">
              <Landmark size={16} className="text-blue-400" />
              <div className="hidden sm:block">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Saldo Bancário</p>
                <p className="text-sm font-black text-white">R$ {formatCurrency(stats.currentWalletBalance)}</p>
              </div>
            </div>
            <button onClick={triggerRefresh} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all">
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>
      )}

      {/* MODAL ABERTURA DE CAIXA FINANCEIRO */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6 relative">
            <button onClick={() => setShowOpenShiftModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-success/10 flex items-center justify-center text-brand-success border border-brand-success/20 mb-4 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]">
                <Zap size={32} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Abrir Caixa Financeiro</h2>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Sessão Exclusiva para Tesouraria</p>
            </div>

            <form onSubmit={handleOpenFinanceShift} className="space-y-4">
              <div>
                <label htmlFor="financeOpeningBalance" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Fundo de Troco (Inicial)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                  <input
                    id="financeOpeningBalance"
                    name="financeOpeningBalance"
                    type="text"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-white font-black text-lg outline-none focus:border-brand-success transition-all"
                    placeholder="0,00"
                    value={financeOpeningBalance}
                    onChange={e => setFinanceOpeningBalance(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-brand-success text-brand-dark rounded-xl font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} /> Confirmar Abertura
              </button>
            </form>
          </div>
        </div>
      )}

      {!activeModal && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-1">
          {menuItems
            .filter(item =>
              currentUser?.permissions.includes(item.permission!) ||
              currentUser?.role === UserRole.SUPER_ADMIN ||
              currentUser?.role === UserRole.COMPANY_ADMIN ||
              currentUser?.email === 'admin@sucatafacil.com'
            )
            .map(item => (
              <button
                key={item.id}
                onClick={() => setActiveModal(item.id as any)}
                className={`enterprise-card p-6 md:p-8 flex items-center gap-4 md:gap-6 transition-all group text-left bg-slate-900/40 border-t-4 ${getColorClasses(item.color)}`}
              >
                <div className={`w-12 md:w-16 h-12 md:h-16 rounded-2xl bg-slate-800 flex items-center justify-center transition-all border border-slate-700 ${item.color === 'green' ? 'text-brand-success group-hover:bg-brand-success/10' :
                  item.color === 'blue' ? 'text-blue-400 group-hover:bg-blue-500/10' :
                    'text-brand-warning group-hover:bg-brand-warning/10'
                  }`}>
                  <item.icon size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-black uppercase text-xs md:text-base tracking-widest group-hover:translate-x-1 transition-transform">{item.label}</h3>
                  <p className="text-slate-500 text-[9px] md:text-xs mt-1 truncate font-medium">{item.description}</p>
                </div>
                <ChevronRight className="text-slate-700 group-hover:text-white transition-all group-hover:translate-x-1" size={20} />
              </button>
            ))}
        </div>
      )}

      {/* MODAL BAIXAS */}
      {activeModal === 'baixas' && (
        <div className="w-full flex flex-col bg-brand-dark animate-in fade-in duration-200 min-h-full">
          <header className="sticky top-0 z-50 bg-brand-card border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 no-print gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-success/10 flex items-center justify-center text-brand-success border border-brand-success/20">
                  <ListChecks size={18} />
                </div>
                <h2 className="text-xs md:text-lg font-black text-white uppercase tracking-tighter">Liquidação</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 items-center justify-center gap-2 w-full md:w-auto">
                <div className="flex flex-col">
                  <label htmlFor="baixas-dateStart" className="sr-only">Data Inicial</label>
                  <input id="baixas-dateStart" name="baixas-dateStart" type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                </div>
                <span className="text-slate-600 font-bold text-[9px]">ATÉ</span>
                <div className="flex flex-col">
                  <label htmlFor="baixas-dateEnd" className="sr-only">Data Final</label>
                  <input id="baixas-dateEnd" name="baixas-dateEnd" type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                </div>
              </div>



              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <div className="grid grid-cols-2 gap-3 w-full md:flex md:w-auto md:items-center">
                  {/* SEARCH FILTERS MOBILE 2-COL */}

                  {/* ROW 1: Partner & Session */}
                  <div className="col-span-1 md:order-4 md:w-auto">
                    <label htmlFor="baixas-filterPartner" className="sr-only">Filtrar Parceiro</label>
                    <input
                      id="baixas-filterPartner"
                      name="baixas-filterPartner"
                      type="text"
                      list="partner-list-options"
                      placeholder="Filtrar Parceiro..."
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-32"
                      value={filterPartner}
                      onChange={e => setFilterPartner(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <datalist id="partner-list-options">
                    {partners.map(p => <option key={p.id} value={(p.name || '').toUpperCase()} />)}
                  </datalist>

                  <div className="col-span-1 md:order-3 md:w-auto">
                    <label htmlFor="baixas-filterSession" className="sr-only">Turno ID</label>
                    <input
                      id="baixas-filterSession"
                      name="baixas-filterSession"
                      type="text"
                      placeholder="Turno ID..."
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-24"
                      value={filterSession}
                      onChange={e => setFilterSession(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  {/* ROW 2: Search Title & Status */}
                  <div className="col-span-1 md:order-1 md:relative md:w-64">
                    <label htmlFor="baixas-searchTerm" className="sr-only">Filtrar títulos</label>
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 md:block hidden" size={14} />
                      <input id="baixas-searchTerm" name="baixas-searchTerm" type="text" placeholder="Filtrar títulos..." className="w-full bg-slate-900 border border-slate-800 px-3 md:pl-9 md:pr-4 py-2 rounded-xl text-white font-bold text-[10px] md:text-xs outline-none focus:border-brand-success" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoComplete="off" />
                    </div>
                  </div>

                  <div className="col-span-1 md:order-2 md:w-auto">
                    <label htmlFor="baixas-filterStatus" className="sr-only">Status</label>
                    <select
                      id="baixas-filterStatus"
                      name="baixas-filterStatus"
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-auto"
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                    >
                      <option value="">TODOS STATUS</option>
                      <option value="ABERTO">ABERTO</option>
                      <option value="ATRASADO">ATRASADO</option>
                    </select>
                  </div>
                </div>

                <div className="w-full md:w-auto mt-2 md:mt-0">
                  <button
                    onClick={() => {
                      setNewTitleForm({
                        natureza: 'SAIDA',
                        tipo: 'despesa',
                        valor: '',
                        categoria: '',
                        parceiro: '',
                        vencimento: db.getToday(),
                        descricao: '',
                        id: ''
                      } as any);
                      setShowNewTitleModal(true);
                    }}
                    className="w-full md:w-auto bg-brand-success text-brand-dark px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-brand-success/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Novo Título
                  </button>
                </div>

                <button onClick={() => setActiveModal(null)} className="hidden md:flex p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all items-center gap-2 px-3 md:px-4">
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Fechar</span>
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* NOVO TÃTULO MODAL */}
          {
            showNewTitleModal && (
              <div className="bg-brand-card border-b border-slate-800 p-6 animate-in slide-in-from-top-4 duration-300 shadow-2xl relative z-[101]">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <PlusSquare className="text-brand-success" />
                      Novo Título (Provisão)
                    </h3>
                    <button onClick={() => setShowNewTitleModal(false)} className="text-slate-500 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateTitle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* NATUREZA SWITCH */}
                    <div className="col-span-1 md:col-span-3 flex justify-center pb-4">
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setNewTitleForm({ ...newTitleForm, natureza: 'SAIDA', tipo: 'despesa' })}
                          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newTitleForm.natureza === 'SAIDA' ? 'bg-brand-error text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          A Pagar (Saída)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewTitleForm({ ...newTitleForm, natureza: 'ENTRADA', tipo: 'entrada' })}
                          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newTitleForm.natureza === 'ENTRADA' ? 'bg-brand-success text-brand-dark shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          A Receber (Entrada)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newTitle-categoria" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Categoria</label>
                      <select
                        id="newTitle-categoria"
                        name="categoria"
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-brand-success"
                        value={newTitleForm.categoria}
                        onChange={e => setNewTitleForm({ ...newTitleForm, categoria: e.target.value })}
                      >
                        <option value="">SELECIONE...</option>
                        {financeCategories
                          .filter(c => (c.type === (newTitleForm.natureza === 'ENTRADA' ? 'in' : 'out') || c.type === 'both') && (c.show_in_title_launch ?? (c as any).showInTitleLaunch ?? true))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(c => (
                            <option key={c.id} value={c.name}>{(c.name || '').toUpperCase()}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="newTitle-parceiro" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Parceiro (Fornecedor/Cliente)</label>
                      <div className="relative">
                        <button
                          id="newTitle-parceiro"
                          type="button"
                          onClick={() => setIsNewTitlePartnerMenuOpen(!isNewTitlePartnerMenuOpen)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-brand-success text-left flex items-center justify-between"
                        >
                          <span className={`truncate ${newTitleForm.parceiro ? 'text-white' : 'text-slate-500'}`}>
                            {newTitleForm.parceiro ? (partners.find(p => p.id === newTitleForm.parceiro)?.name || newTitleForm.parceiro) : 'SELECIONE O PARCEIRO...'}
                          </span>
                          <ChevronDown size={14} className={`text-slate-500 transition-transform ${isNewTitlePartnerMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isNewTitlePartnerMenuOpen && (
                          <div className="absolute top-full left-0 w-full mt-2 bg-brand-card border border-slate-800 rounded-xl shadow-2xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/50">
                              <Search size={14} className="text-slate-500" />
                              <input
                                autoFocus
                                type="text"
                                placeholder="Filtrar parceiro..."
                                className="w-full bg-transparent border-none text-xs text-white outline-none uppercase font-bold"
                                value={newTitlePartnerSearch}
                                onChange={e => setNewTitlePartnerSearch(e.target.value)}
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                              <button
                                type="button"
                                onClick={() => { setNewTitleForm({ ...newTitleForm, parceiro: '' }); setIsNewTitlePartnerMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase transition-colors border-b border-slate-800/30"
                              >
                                <span>-- LIMPAR SELEÇÃO --</span>
                              </button>
                              {partners
                                .filter(p => p.name.toUpperCase().includes(newTitlePartnerSearch.toUpperCase()) || (p.document && p.document.includes(newTitlePartnerSearch)))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { setNewTitleForm({ ...newTitleForm, parceiro: p.id }); setIsNewTitlePartnerMenuOpen(false); }}
                                    className="w-full text-left px-4 py-3 hover:bg-brand-success/10 text-[10px] font-bold text-slate-300 uppercase transition-colors border-b border-slate-800/30 last:border-0 flex items-center justify-between"
                                  >
                                    <span>{p.name}</span>
                                    {newTitleForm.parceiro === p.id && <CheckCircle2 size={12} className="text-brand-success" />}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newTitle-paymentTerm" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Prazo / Condição</label>
                      <select
                        id="newTitle-paymentTerm"
                        name="payment_term_id"
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-brand-success"
                        value={newTitleForm.payment_term_id}
                        onChange={e => {
                          const val = e.target.value;
                          const term = allPaymentTerms.find(t => t.id === val || t.uuid === val);
                          let newVenc = newTitleForm.vencimento;
                          if (term && term.days !== undefined) {
                            const d = new Date();
                            d.setDate(d.getDate() + (term.days || 0));
                            newVenc = d.toISOString().split('T')[0];
                          }
                          setNewTitleForm({ ...newTitleForm, payment_term_id: val, vencimento: newVenc });
                        }}
                      >
                        <option value="">SELECIONE...</option>
                        {allPaymentTerms
                          .filter(t => t.show_in_title_launch || (t as any).showInTitleLaunch)
                          .map(t => (
                            <option key={t.id} value={t.id || t.uuid}>{(t.name || '').toUpperCase()}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="newTitle-vencimento" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data de Vencimento</label>
                      <input
                        id="newTitle-vencimento"
                        name="vencimento"
                        required
                        type="date"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-brand-success [color-scheme:dark]"
                        value={newTitleForm.vencimento}
                        onChange={e => setNewTitleForm({ ...newTitleForm, vencimento: e.target.value })}
                      />
                    </div>

                    <div>
                      <label htmlFor="newTitle-valor" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Valor do Título</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                        <input
                          id="newTitle-valor"
                          name="valor"
                          required
                          type="text"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 pl-8 text-white font-bold text-xs outline-none focus:border-brand-success"
                          placeholder="0,00"
                          value={newTitleForm.valor}
                          onChange={e => setNewTitleForm({ ...newTitleForm, valor: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newTitle-descricao" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Descrição</label>
                      <input
                        id="newTitle-descricao"
                        name="descricao"
                        required
                        type="text"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-brand-success"
                        placeholder="Ex: CONTA DE LUZ JANEIRO/26"
                        value={newTitleForm.descricao}
                        onChange={e => setNewTitleForm({ ...newTitleForm, descricao: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-3 pt-4 border-t border-slate-800 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNewTitleModal(false)}
                        className="px-6 py-3 bg-slate-800 text-slate-400 rounded-xl font-black uppercase text-[10px] hover:text-white transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-8 py-3 bg-brand-success text-brand-dark rounded-xl font-black uppercase text-[10px] hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                      >
                        <CheckCircle2 size={16} /> Criar Título
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )
          }

          <main className="flex-1 overflow-y-auto p-3 md:p-8 bg-brand-dark custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print [&>*:nth-child(odd):last-child]:col-span-2">
                <div className="enterprise-card p-5 border-l-4 border-l-brand-success bg-brand-success/5 shadow-lg">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">A Receber (Aberto)</p>
                  <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(baixasMetrics.abertoIn)}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-success"><TrendingUp size={12} /><span className="text-[8px] font-bold uppercase">Projeção de Entrada</span></div>
                </div>
                <div className="enterprise-card p-5 border-l-4 border-l-brand-error bg-brand-error/5 shadow-lg">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">A Pagar (Aberto)</p>
                  <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(baixasMetrics.abertoOut)}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-error"><TrendingDown size={12} /><span className="text-[8px] font-bold uppercase">Projeção de Saída</span></div>
                </div>
                <div className="enterprise-card p-5 border-l-4 border-l-brand-error bg-brand-error/20 shadow-lg">
                  <p className="text-[9px] font-black text-brand-error uppercase tracking-widest mb-1">Atrasados (Saídas)</p>
                  <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(baixasMetrics.atrasadoOut)}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-error animate-pulse"><AlertTriangle size={12} /><span className="text-[8px] font-bold uppercase">Vencidos em Aberto</span></div>
                </div>
                <div className="enterprise-card p-5 border-l-4 border-l-brand-warning bg-brand-warning/10 shadow-lg">
                  <p className="text-[9px] font-black text-brand-warning uppercase tracking-widest mb-1">Atrasados (Entradas)</p>
                  <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(baixasMetrics.atrasadoIn)}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-warning"><AlertCircle size={12} /><span className="text-[8px] font-bold uppercase">Crédito Pendente</span></div>
                </div>
              </div>



              {(filterType === 'ALL' || filterType === 'ENTRADA') && (
                <TableLayout
                  title="A Receber (Vendas e Entradas)"
                  items={filteredItems.filter(f => f.natureza === 'ENTRADA')}
                  icon={ArrowUpCircle}
                  iconColor="text-brand-success"
                  partners={partners}
                  users={teamUsers}
                  activeSession={activeSession}
                  isLiquidating={isLiquidating}
                  setLiquidationModal={setLiquidationModal}
                  onEdit={handleEditTitle}
                  onDelete={handleDeleteTitle}
                  onReverse={handleReverseLiquidation}
                />
              )}
              {(filterType === 'ALL' || filterType === 'SAIDA') && (
                <TableLayout
                  title="A Pagar (Compras e Despesas)"
                  items={filteredItems.filter(f => f.natureza === 'SAIDA')}
                  icon={ArrowDownCircle}
                  iconColor="text-brand-error"
                  partners={partners}
                  users={teamUsers}
                  activeSession={activeSession}
                  isLiquidating={isLiquidating}
                  setLiquidationModal={setLiquidationModal}
                  onEdit={handleEditTitle}
                  onDelete={handleDeleteTitle}
                  onReverse={handleReverseLiquidation}
                />
              )}

              {activeFinanceSession && sessionBaixas.length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-800/50">
                  <TableLayout
                    title="Histórico de Movimentações do Turno"
                    items={sessionBaixas}
                    icon={CheckCircle2}
                    iconColor="text-blue-400"
                    partners={partners}
                    users={teamUsers}
                    activeSession={activeFinanceSession}
                    isLiquidating={false}
                    setLiquidationModal={() => { }}
                    onReverse={handleReverseLiquidation}
                    showBaixar={false}
                  />
                </div>
              )}
            </div>
          </main>
        </div >
      )}

      {/* MODAL CONFERÊNCIA */}
      {
        activeModal === 'conferencia' && (
          <div className="w-full flex flex-col bg-brand-dark animate-in fade-in duration-200 min-h-full">
            <header className="sticky top-0 z-50 bg-brand-card border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 no-print gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-warning/10 flex items-center justify-center text-brand-warning border border-brand-warning/20">
                    <ShieldCheck size={18} />
                  </div>
                  <h2 className="text-xs md:text-lg font-black text-white uppercase tracking-tighter">Auditoria de Turnos</h2>
                </div>
                <button onClick={() => setActiveModal(null)} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                {/* DATE RANGE - KEEP AS IS BUT FULL WIDTH MOBILE */}
                <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 items-center justify-center gap-2 w-full md:w-auto">
                  <div className="flex flex-col flex-1 md:flex-none">
                    <label htmlFor="auditDateStart" className="sr-only">Data Inicial Auditoria</label>
                    <input id="auditDateStart" name="auditDateStart" type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={auditDateStart} onChange={e => setAuditDateStart(e.target.value)} />
                  </div>
                  <span className="text-slate-600 font-bold text-[9px]">ATÉ</span>
                  <div className="flex flex-col flex-1 md:flex-none">
                    <label htmlFor="auditDateEnd" className="sr-only">Data Final Auditoria</label>
                    <input id="auditDateEnd" name="auditDateEnd" type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={auditDateEnd} onChange={e => setAuditDateEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full md:flex md:w-auto md:items-center">
                  {/* MOBILE ROW 1: ID & STATUS */}
                  <div className="col-span-1 md:w-auto">
                    <label htmlFor="auditFilterSessionId" className="sr-only">Turno ID Auditoria</label>
                    <input
                      id="auditFilterSessionId"
                      name="auditFilterSessionId"
                      type="text"
                      placeholder="Turno ID..."
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-24"
                      value={auditFilterSessionId}
                      onChange={e => setAuditFilterSessionId(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  <div className="col-span-1 md:w-auto">
                    <label htmlFor="auditFilterStatus" className="sr-only">Status Auditoria</label>
                    <select
                      id="auditFilterStatus"
                      name="auditFilterStatus"
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-auto"
                      value={auditFilterStatus}
                      onChange={e => setAuditFilterStatus(e.target.value)}
                    >
                      <option value="all">TODOS STATUS</option>
                      <option value="open">ABERTO</option>
                      <option value="closed">FECHADO</option>
                      <option value="reconciled">CONFERIDO</option>
                    </select>
                  </div>

                  {/* MOBILE ROW 2: OPERATOR & AUDITOR */}
                  <div className="col-span-1 md:w-auto">
                    <label htmlFor="auditOperatorFilter" className="sr-only">Operador Auditoria</label>
                    <select
                      id="auditOperatorFilter"
                      name="auditOperatorFilter"
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-auto"
                      value={auditOperatorFilter}
                      onChange={e => setAuditOperatorFilter(e.target.value)}
                    >
                      <option value="all">TODOS OPERADORES</option>
                      {teamUsers.map(u => <option key={u.id} value={u.id}>{(u.name || '').toUpperCase()}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1 md:w-auto">
                    <label htmlFor="auditAuditorFilter" className="sr-only">Auditor</label>
                    <select
                      id="auditAuditorFilter"
                      name="auditAuditorFilter"
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-full md:w-auto"
                      value={auditAuditorFilter}
                      onChange={e => setAuditAuditorFilter(e.target.value)}
                    >
                      <option value="all">TODOS AUDITORES</option>
                      {teamUsers.map(u => <option key={u.id} value={u.id}>{(u.name || '').toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <button onClick={() => setActiveModal(null)} className="hidden md:flex p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all items-center gap-2 px-3 md:px-4">
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Fechar</span>
                  <X size={18} />
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-3 md:p-8 bg-brand-dark custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="enterprise-card overflow-hidden shadow-2xl border-slate-800 bg-slate-900/10">
                  <div className="overflow-x-auto scrollbar-thick">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest bg-slate-900/60 border-b border-slate-800">
                          <th className="px-6 py-5">Turno (ID)</th>
                          <th className="px-6 py-5">Tipo</th>
                          <th className="px-6 py-5">Início do Turno</th>
                          <th className="px-6 py-5">Operador</th>
                          <th className="px-6 py-5">Auditor</th>
                          <th className="px-6 py-5 text-right">Valor Real</th>
                          <th className="px-6 py-5 text-right">Valor Informado</th>
                          <th className="px-6 py-5 text-right">Valor Auditado</th>
                          <th className="px-6 py-5 text-right">Diferença</th>
                          <th className="px-6 py-5 text-center">Status</th>
                          <th className="px-6 py-5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {filteredSessions.map(session => {
                          // Calculate System Balance (Valor Real) - "Entradas - Saídas em Dinheiro" + "Entradas em Cheque"
                          const sessionRecords = allFinancialRecords.filter(r => r.caixa_id === session.id && r.status !== 'reversed' && r.status !== 'cancelled' && r.categoria !== 'Abertura de Caixa');

                          // Filter for Cash transactions
                          const cashRecords = sessionRecords.filter(r => {
                            if (!r.payment_term_id && !r.paymentTermId) return false;
                            const tId = r.payment_term_id || r.paymentTermId;
                            const term = allPaymentTerms.find(t => t.id === tId || t.uuid === tId);
                            const name = (term?.name || '').toUpperCase();
                            return name.includes('DINHEIRO') || name === 'À VISTA';
                          });

                          // Filter for Check transactions (Only Inputs matter for "Check in Hand")
                          const checkRecords = sessionRecords.filter(r => {
                            if (!r.payment_term_id && !r.paymentTermId) return false;
                            const tId = r.payment_term_id || r.paymentTermId;
                            const term = allPaymentTerms.find(t => t.id === tId || t.uuid === tId);
                            const name = (term?.name || '').toUpperCase();
                            return name.includes('CHEQUE');
                          });

                          const totalCashInputs = cashRecords.filter(r => r.natureza === 'ENTRADA').reduce((sum, r) => sum + r.valor, 0);
                          const totalCashOutputs = cashRecords.filter(r => r.natureza === 'SAIDA').reduce((sum, r) => sum + r.valor, 0);
                          const totalCheckInputs = checkRecords.filter(r => r.natureza === 'ENTRADA').reduce((sum, r) => sum + r.valor, 0);

                          // Formula: (Net Cash Flow) + (Check Inputs) - (Cash Outputs)
                          // User requested: "pega todo valor de entrada em dinheiro e cheque e subtrai pelo valor de saidas dinheiro"
                          const opening = session.openingBalance || session.opening_balance || 0;
                          const valorReal = opening + (totalCashInputs + totalCheckInputs) - totalCashOutputs;

                          // Get Other Values
                          const valorInformado = session.closingBalance || session.closing_balance || 0;
                          const valorAuditado = session.reconciledBalance || session.reconciledBalance || 0;
                          const isReconciled = session.status === 'reconciled';

                          // Calculate Difference: (Verified or Reported) - Real
                          // User Request: "comparar Valor Real com Valor Auditado"
                          // Logic: Se tiver Valor Auditado (reconciledBalance != 0 ou status reconciled), usa ele.
                          // Caso contrário, se for 0 e não estiver reconciliado, usa Valor Informado?
                          // The user said "not from the informed value". But if it's not audited yet, auditado is 0. 
                          // Assuming if Auditado is 0 and not reconciled, we might want to show difference from Informado (pre-audit).
                          // BUT user said "calculations... not calculating correctly... should be done from valor real with valor auditado".
                          // Let's assume for the "Conferência" process, we prioritize Auditado.
                          // If Auditado is 0 (and open/closed), maybe show diff based on Informado?
                          // However, strictly following request: "na auditoria de turno... não do valor informado".
                          // If I strictly use Auditado: if it's 0 (not done), diff will be huge (0 - Real).
                          // I'll assume: if isReconciled OR hasReconciledBalance, use Auditado. Else use Informado (as a fallback for Open sessions).
                          // But wait, the user specifically complained about "Auditoria de Turno" context.
                          // If I open the table, I want to see if the audit matched.

                          // Current logic: const compareValue = isReconciled ? valorAuditado : valorInformado;
                          // This seems logically correct (if reconciled, use reconciled. if not, use physical).
                          // Maybe the issue is when it *IS* reconciled but for some reason we want to compare differently?
                          // Or maybe the user THINKS it's using informed but it's not?
                          // Actually, looking at the previous screenshot (Step 3552 request), the session IS Reconciled (CONFERIDO button is blue/filled? No, status says "CONFERIDO").
                          // So `isReconciled` should be true.
                          // So it should be using `valorAuditado`.
                          // Why did the user complain?
                          // "calculo da diferença deve ser feita do valor real com valor auditado ... e não do valor informado"
                          // Maybe `valorInformado` was being displayed in the `Valor Auditado` column?
                          // Let's check lines 1963-1964 (columns).

                          // Column Headers (1890-1892): Valor Informado | Valor Auditado | Diferença
                          // Column Values (down below):
                          // 1960: {`R$ ${valorInformado...}`}
                          // 1963: {`R$ ${valorAuditado...}`}
                          // 1966: Diff

                          // If session is Reconciled, `compareValue` is `valorAuditado`. `diff = valorAuditado - valorReal`.
                          // This matches the user request.
                          // UNLESS `isReconciled` check is failing? `session.status === 'reconciled'`.
                          // Let's look at the data in the screenshot.
                          // Row 1: Valor Real = -43.67. Valor Auditado (Conferido) = R$ 89,87.
                          // This was BEFORE my fix to Valor Real (which added opening balance).
                          // Now Valor Real should be correct.

                          // The user might be seeing a diff based on `valorInformado` because maybe `isReconciled` is false?
                          // Or maybe they just want it to ALWAYS be `valorAuditado - valorReal` even if not reconciled? (If not reconciled, Auditado is usually 0, so diff is -Real).

                          // Re-reading: "não do valor informado".
                          // I will change it to ALWAYS use `valorAuditado` IF it's different from zero/null, OR if we strictly want to ignore Informed.
                          // But for an open session, Auditado is 0. Diff would be (0 - Real). That might be misleading if they entered a Physical count (Informed).

                          // Let's assume the user specifically meant for Reconciled/Audited sessions, or they want the "Diferença" column to explicitly track the Audit target.
                          // Given the previous screenshot showed "CONFERIDO", it was reconciled.
                          // If I change the logic to:
                          // const compareValue = (session.reconciledBalance !== undefined && session.reconciledBalance !== null) ? session.reconciledBalance : valorInformado;
                          // If reconciledBalance is 0 (typical default), it might be valid.

                          // Let's try strictly following: "Real vs Auditado".
                          // But safely fallback to Informed if Auditado implies "not yet audited" (i.e. we are comparing Physical vs System).

                          // Wait, if I look at the screenshot again (Step 3476):
                          // Valor Real (System) = -43.67 (Fixed now to allow opening balance)
                          // Valor Informado = 0,00
                          // Valor Auditado = 46,20
                          // Diferença = 89,87

                          // Math: 
                          // If using Auditado: 46.20 - (-43.67) = 89.87.
                          // If using Informed: 0.00 - (-43.67) = 43.67.

                          // The screenshot shows Diff = 89.87.
                          // This means it WAS ALREADY using Valor Auditado (46.20).
                          // 46.20 - (-43.67) = 89.87.

                          // So the calculation WAS CORRECTLY using Valor Auditado.
                          // The problem was "Valor Real" being wrong (negative).
                          // Since I just fixed "Valor Real" in the previous step (added opening balance),
                          // Valor Real should now be approx 45.21 (from Modal screenshot).
                          // New Diff = 46.20 (Auditado) - 45.21 (Real) = 0.99 (approx).

                          // So... why did the user say "make sure it is calculated from Auditado not Informed"?
                          // Maybe they *thought* it was calculating from Informed because the bad math confused them?
                          // OR, maybe they want the *Condition* to be different?
                          // The current condition: `const compareValue = isReconciled ? valorAuditado : valorInformado;`

                          // If I just keep the logic `diff = compareValue - valorReal`, and I fixed `valorReal`, it should be correct.
                          // BUT, to be safe and explicit per user request, I will ensure `valorAuditado` is used if available.

                          const compareValue = (isReconciled || (valorAuditado !== 0 && valorAuditado !== null)) ? valorAuditado : valorInformado;
                          const diff = compareValue - valorReal;

                          return (
                            <tr key={session.id} className="hover:bg-slate-800/20 transition-all text-xs">
                              <td className="px-6 py-4 font-mono text-slate-500 font-bold">
                                #{session.id.slice(0, 8).toUpperCase()}
                              </td>
                              <td className="px-6 py-4">
                                {session.type === 'finance' ? (
                                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase">FINANCEIRO</span>
                                ) : (
                                  <span className="bg-slate-800/50 text-slate-400 border border-slate-700/50 px-2 py-0.5 rounded text-[9px] font-black uppercase">PDV</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-mono text-slate-400 font-bold">{new Date(session.openingTime || session.opening_time || '').toLocaleString()}</td>
                              <td className="px-6 py-4 font-black uppercase text-slate-200">{session.userName || session.user_name}</td>
                              <td className="px-6 py-4 font-black uppercase text-brand-success/80 text-[10px]">{session.reconciledByName || session.reconciled_by_name || '-'}</td>

                              {/* VALOR REAL */}
                              <td className="px-6 py-4 text-right font-bold text-white">R$ {formatCurrency(valorReal)}</td>

                              {/* VALOR INFORMADO (Saldo Físico) */}
                              <td className="px-6 py-4 text-right font-bold text-slate-300">R$ {formatCurrency(valorInformado)}</td>

                              {/* VALOR AUDITADO */}
                              <td className="px-6 py-4 text-right font-bold text-blue-400">{isReconciled ? `R$ ${formatCurrency(valorAuditado)}` : '-'}</td>

                              {/* DIFERENÇA */}
                              <td className={`px-6 py-4 text-right font-black ${Math.abs(diff) < 0.005 ? 'text-slate-600' : diff > 0 ? 'text-brand-success' : 'text-brand-error'}`}>
                                {Math.abs(diff) < 0.005 ? '-' : `R$ ${formatCurrency(diff)}`}
                              </td>

                              <td className="px-6 py-4 text-center">
                                <span className={`inline-block px-3 py-1.5 rounded-full text-[9px] font-black uppercase border shadow-sm whitespace-nowrap ${session.status === 'open' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                                  session.status === 'closed' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' :
                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  }`}>
                                  {session.status === 'open' ? 'Em Aberto' : session.status === 'closed' ? 'Aguardando Auditoria' : 'Conferido'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      // Attempt to find the RECONCILIATION transactions to get the correct bank names
                                      const reconciliationTxs = walletTransactions.filter(t =>
                                        t.categoria === 'CONFERÊNCIA DE CAIXA' &&
                                        t.descricao.includes(session.id.slice(0, 6).toUpperCase()) &&
                                        t.status !== 'cancelled'
                                      );

                                      // Look for "DINHEIRO" specifically in the description or assume first one is money if not specified? 
                                      // Logic in handleProcessReconciliation uses: DESC: `DEPÓSITO MASTER [DINHEIRO] ...`
                                      const txDinheiro = reconciliationTxs.find(t => t.descricao.includes('[DINHEIRO]'));
                                      const txCheque = reconciliationTxs.find(t => t.descricao.includes('[CHEQUE]'));

                                      setAuditModal({
                                        show: true,
                                        session,
                                        bankNameCash: (txDinheiro?.parceiro || (session.status === 'reconciled' ? 'CARTEIRA' : '')).toUpperCase(),
                                        bankNameCheck: (txCheque?.parceiro || (session.status === 'reconciled' ? 'CHEQUE' : '')).toUpperCase(),
                                        auditedBreakdown: (session.reconciledBreakdown || session.reconciled_breakdown || session.physicalBreakdown || session.physical_breakdown || {}) as any,
                                        readOnly: true
                                      });
                                    }}

                                    className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700/50 hover:border-slate-600 shadow-sm"
                                    title="Visualizar Detalhes"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  {session.status === 'closed' && (
                                    <button onClick={() => {
                                      const breakdown = (session.physicalBreakdown || session.physical_breakdown || {}) as any;
                                      // Ensure string values for the inputs
                                      const stringifiedBreakdown: Record<string, string> = {};
                                      Object.entries(breakdown).forEach(([k, v]) => {
                                        stringifiedBreakdown[k] = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v);
                                      });

                                      setAuditModal({
                                        show: true,
                                        session,
                                        bankNameCash: '',
                                        bankNameCheck: '',
                                        auditedBreakdown: stringifiedBreakdown
                                      });
                                    }} className="px-5 py-2 bg-brand-warning text-black rounded-xl font-black uppercase text-[10px] shadow-lg shadow-brand-warning/20 hover:scale-105 transition-all whitespace-nowrap">Conferir Turno</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredSessions.length === 0 && (
                          <tr><td colSpan={11} className="py-20 text-center text-slate-600 italic uppercase font-bold text-[10px]">Nenhum turno localizado para auditoria</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </main>
          </div >
        )
      }
      {/* MODAL CARTEIRA (Bancos) */}
      {
        activeModal === 'carteira' && (
          <div className="w-full flex flex-col bg-brand-dark animate-in fade-in duration-200 min-h-full">
            <header className="sticky top-0 z-50 bg-brand-card border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 no-print gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <Landmark size={18} />
                  </div>
                  <h2 className="text-xs md:text-lg font-black text-white uppercase tracking-tighter">Extrato Bancário</h2>
                </div>
                <button onClick={() => setActiveModal(null)} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 items-center justify-center gap-2 w-full md:w-auto">
                  <div className="flex flex-col">
                    <label htmlFor="bankStmt-dateStart" className="sr-only">Data Inicial Extrato</label>
                    <input id="bankStmt-dateStart" name="bankStmt-dateStart" type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                  </div>
                  <span className="text-slate-600 font-bold text-[9px]">ATÉ</span>
                  <div className="flex flex-col">
                    <label htmlFor="bankStmt-dateEnd" className="sr-only">Data Final Extrato</label>
                    <input id="bankStmt-dateEnd" name="bankStmt-dateEnd" type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full md:flex md:w-auto md:items-center">
                  <div className="w-full md:w-auto col-span-1 order-1 md:order-3">
                    <label htmlFor="bankStmt-operatorFilter" className="sr-only">Operador</label>
                    <select
                      id="bankStmt-operatorFilter"
                      name="bankStmt-operatorFilter"
                      className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 w-full md:w-auto md:min-w-[150px]"
                      value={walletFilterOperator}
                      onChange={e => setWalletFilterOperator(e.target.value)}
                    >
                      <option value="">TODOS OPERADORES</option>
                      {teamUsers.map(u => <option key={u.id} value={u.id}>{(u.name || '').toUpperCase()}</option>)}
                    </select>
                  </div>

                  <select
                    id="bankStmt-bankFilter"
                    name="bankStmt-bankFilter"
                    className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 w-full md:w-auto md:max-w-[150px] col-span-1 order-2 md:order-2"
                    value={walletFilterBanco}
                    onChange={e => setWalletFilterBanco(e.target.value)}
                  >
                    <option value="">TODOS BANCOS</option>
                    {banks.map(b => <option key={b.id} value={b.name}>{(b.name || '').toUpperCase()}</option>)}
                  </select>

                  <div className="relative w-full md:w-64 col-span-1 order-3 md:order-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input id="bankStmt-searchTerm" name="bankStmt-searchTerm" type="text" placeholder="Filtrar..." className="w-full bg-slate-900 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>

                  <button
                    onClick={() => setShowWalletManualEntry(true)}
                    className="w-full md:w-auto px-5 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg transition-all bg-brand-success text-white shadow-brand-success/20 hover:scale-105 col-span-1 order-4 md:order-4"
                  >
                    Novo Lançamento
                  </button>
                </div>

                <button onClick={() => setActiveModal(null)} className="hidden md:flex p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all items-center gap-2 px-3 md:px-4">
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Fechar</span>
                  <X size={18} />
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-3 md:p-8 bg-brand-dark custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-6">

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print [&>*:nth-child(odd):last-child]:col-span-2">
                  <div className="enterprise-card p-5 border-l-4 border-l-brand-success bg-brand-success/5 shadow-lg">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Entradas (Período)</p>
                    <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(walletMetrics.totalEntrada)}</h3>
                    <div className="flex items-center gap-1.5 mt-2 text-brand-success"><ArrowUpCircle size={12} /><span className="text-[8px] font-bold uppercase">Créditos Confirmados</span></div>
                  </div>
                  <div className="enterprise-card p-5 border-l-4 border-l-brand-error bg-brand-error/5 shadow-lg">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Saídas (Período)</p>
                    <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(walletMetrics.totalSaida)}</h3>
                    <div className="flex items-center gap-1.5 mt-2 text-brand-error"><ArrowDownCircle size={12} /><span className="text-[8px] font-bold uppercase">Débitos Realizados</span></div>
                  </div>
                  <div className={`enterprise-card p-5 border-l-4 shadow-lg ${walletMetrics.result >= 0 ? 'border-l-blue-500 bg-blue-500/5' : 'border-l-brand-warning bg-brand-warning/5'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${walletMetrics.result >= 0 ? 'text-blue-400' : 'text-brand-warning'}`}>Resultado do Período</p>
                    <h3 className="text-sm md:text-xl font-black text-white">R$ {formatCurrency(walletMetrics.result)}</h3>
                    <div className={`flex items-center gap-1.5 mt-2 ${walletMetrics.result >= 0 ? 'text-blue-400' : 'text-brand-warning'}`}><Scale size={12} /><span className="text-[8px] font-bold uppercase">Balanço do Filtro</span></div>
                  </div>
                  <div className="enterprise-card p-5 border-l-4 border-l-slate-600 bg-slate-800/30 shadow-lg">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Final (no Filtro)</p>
                    <h3 className="text-sm md:text-xl font-black text-white">{walletMetrics.finalBalance !== null ? `R$ ${formatCurrency(walletMetrics.finalBalance)}` : '---'}</h3>
                    <div className="flex items-center gap-1.5 mt-2 text-slate-400"><Wallet size={12} /><span className="text-[8px] font-bold uppercase">Posição Atual</span></div>
                  </div>
                </div>

                <div className="enterprise-card overflow-hidden shadow-2xl border-slate-800 bg-slate-900/10">
                  <div className="overflow-x-auto scrollbar-thick">
                    <table className="w-full text-left min-w-[1100px]">
                      <thead>
                        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest bg-slate-900/60 border-b border-slate-800">
                          <th className="px-6 py-5">Data / Hora</th>
                          <th className="px-6 py-5">Conta / Banco</th>
                          <th className="px-6 py-5">Identificação / Detalhes</th>
                          <th className="px-6 py-5">Operador</th>
                          <th className="px-6 py-5 text-right">E (+)</th>
                          <th className="px-6 py-5 text-right">S (-)</th>
                          <th className="px-6 py-5 text-right">Saldo Real</th>
                          <th className="px-6 py-5 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {dynamicWalletData.map((t: any) => {
                          const term = allHubTerms.find(term => term.id === t.payment_term_id || term.uuid === t.payment_term_id);
                          const bank = banks.find(b => b.id === t.parceiro);
                          const operator = teamUsers.find(u => u.id === t.user_id || (u as any).user_id === t.user_id);
                          const isCancelled = t.status === 'cancelled';
                          const isSystem = t.categoria === 'CONFERÊNCIA DE CAIXA' || t.categoria === 'CONFERÃŠNCIA DE CAIXA' || t.descricao.includes('TURNO #') || t.categoria === 'ABERTURA DE CAIXA' || t.descricao.includes('FUNDO DE TROCO');
                          const isOpening = t.categoria === 'ABERTURA DE CAIXA' || t.descricao.includes('FUNDO DE TROCO');

                          return (
                            <tr key={t.id} className={`text-xs transition-all group ${isCancelled ? 'opacity-50 grayscale' : 'hover:bg-slate-800/30'}`}>
                              <td className={`px-6 py-4 text-slate-500 font-mono font-bold ${isCancelled ? 'line-through' : ''}`}>{new Date(t.created_at).toLocaleDateString()} <span className="opacity-40">{new Date(t.created_at).toLocaleTimeString()}</span></td>
                              <td className={`px-6 py-4 font-black uppercase text-slate-200 ${isCancelled ? 'line-through' : ''}`}>
                                {bank ? bank.name : (t.parceiro === 'RECONCILIADO' || !t.parceiro ? (t.descricao.includes('[DINHEIRO]') ? 'CARTEIRA' : t.descricao.includes('[CHEQUE]') ? 'CHEQUE' : t.parceiro) : t.parceiro)}
                              </td>
                              <td className="px-6 py-4">
                                <p className={`text-slate-300 uppercase font-medium whitespace-normal break-words ${isCancelled ? 'line-through' : ''}`}>{t.descricao} {isCancelled && <span className="text-red-500 font-bold ml-2">(CANCELADO)</span>}</p>
                                <p className={`text-[9px] text-slate-500 uppercase font-bold tracking-tighter ${isCancelled ? 'line-through' : ''}`}>{term?.name || t.forma || 'Lançamento Direto'}</p>
                              </td>
                              <td className={`px-6 py-4 uppercase text-[10px] font-black ${isCancelled ? 'line-through text-slate-500' : 'text-brand-success/80'}`}>
                                {operator ? operator.name : (t.operador_name || 'Sistema')}
                              </td>
                              <td className={`px-6 py-4 text-right font-black ${isCancelled ? 'line-through text-slate-500' : 'text-brand-success'}`}>{t.valor_entrada > 0 ? `R$ ${formatCurrency(t.valor_entrada)}` : '-'}</td>
                              <td className={`px-6 py-4 text-right font-black ${isCancelled ? 'line-through text-slate-500' : 'text-brand-error'}`}>{t.valor_saida > 0 ? `R$ ${formatCurrency(t.valor_saida)}` : '-'}</td>
                              <td className="px-6 py-4 text-right font-black text-white bg-slate-800/20">{isCancelled ? '---' : `R$ ${formatCurrency(t.computedBalance)}`}</td>
                              <td className="px-6 py-4 text-center">
                                {!isCancelled && (
                                  <div className="flex items-center justify-center gap-2">
                                    {isSystem ? (
                                      null // Removido botão de estorno de conferência do extrato por pedido do usuário
                                    ) : (
                                      <>
                                        <button onClick={() => handleEditTransaction(t)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Editar"><Edit size={14} /></button>
                                        <button onClick={() => handleDeleteTransaction(t.id || t.uuid)} className="p-2 text-brand-error hover:bg-brand-error/10 rounded-lg transition-all" title="Cancelar Lançamento"><Trash2 size={14} /></button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {dynamicWalletData.length === 0 && (
                          <tr><td colSpan={7} className="py-20 text-center text-slate-600 italic uppercase font-bold text-[10px]">Nenhuma movimentação bancÃ¡ria localizada</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </main>
          </div >
        )
      }

      {/* MODAL DE LIQUIDAÇÃO (AÇÃO BAIXA) */}
      {
        liquidationModal.show && liquidationModal.record && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
            <div className="enterprise-card w-full max-md overflow-hidden shadow-2xl border-brand-success/30 animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-800 bg-brand-success/5 flex justify-between items-center">
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3"><CheckCircle2 className="text-brand-success" /> Efetivar Baixa Financeira</h2>
                <button onClick={() => setLiquidationModal({ show: false, record: null, termId: '', dueDate: '', receivedValue: '' })}><X size={24} className="text-slate-500" /></button>
              </div>
              <form onSubmit={handleProcessLiquidation} className="p-8 space-y-6">
                <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Título / Identificação</p>
                  <p className="text-white font-bold text-sm uppercase leading-tight">{liquidationModal.record.description}</p>
                  <div className="flex justify-between items-end mt-4">
                    <p className="text-brand-success font-black text-3xl">R$ {formatCurrency(liquidationModal.record.valor)}</p>
                    <p className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${liquidationModal.record.natureza === 'ENTRADA' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' : 'bg-brand-error/10 text-brand-error border-brand-error/20'}`}>{liquidationModal.record.natureza}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="liquidation-termId" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Meio de Pagamento (Destino/Origem)</label>
                  <select
                    id="liquidation-termId"
                    name="payment_term_id"
                    required
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success transition-all shadow-inner"
                    value={liquidationModal.termId}
                    onChange={e => {
                      const selId = e.target.value;
                      const terms = liquidationModal.record?.natureza === 'SAIDA' ? purchasePaymentTerms : salePaymentTerms;
                      const term = terms.find(t => t.id === selId || t.uuid === selId);
                      const days = term?.days || 0;
                      const calcDate = new Date();
                      calcDate.setDate(calcDate.getDate() + days);

                      // Usar extração local para evitar erro de fuso (UTC vs Brasil)
                      const localDate = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'America/Sao_Paulo',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }).format(calcDate);

                      setLiquidationModal({ ...liquidationModal, termId: selId, dueDate: localDate });
                    }}
                  >
                    <option value="">SELECIONE O MEIO DE PAGAMENTO...</option>
                    {(liquidationModal.record.natureza === 'SAIDA' ? purchasePaymentTerms : salePaymentTerms).map(t => <option key={t.id} value={t.id || t.uuid}>{(t.name || '').toUpperCase()}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={isLiquidating} className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-brand-success/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all">
                  {isLiquidating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {isLiquidating ? 'Processando...' : 'Confirmar e Liquidar'}
                </button>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL DE ENCERRAMENTO (FECHAMENTO CEGO) */}
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
                    <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><UserIcon size={12} /> {activeFinanceSession?.userName || activeFinanceSession?.user_name}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><Receipt size={12} /> Turno: #{activeFinanceSession?.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-[10px] font-black text-brand-success uppercase flex items-center gap-1.5"><Clock size={12} /> Aberto às {new Date(activeFinanceSession?.openingTime || '').toLocaleTimeString()}</span>
                    <span className="text-[10px] font-black text-brand-warning uppercase flex items-center gap-1.5"><Zap size={12} /> Período: {operationalTime}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsClosingModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form ref={closingFormRef} onSubmit={handleFinalCloseFinanceShift} className="p-8 space-y-8">
              {/* Balões de Resumo Rápido */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-success/10 rounded-xl flex items-center justify-center text-brand-success"><Banknote size={20} /></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Saldo Físico em Mãos</p>
                    <p className="text-xl font-black text-white mt-1">R$ {formatCurrency(closingMetrics.totalFisico)}</p>
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><ArrowUpCircle size={20} /></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Entradas</p>
                    <p className="text-xl font-black text-white mt-1">R$ {formatCurrency(closingMetrics.totalEntradasInfo)}</p>
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-error/10 rounded-xl flex items-center justify-center text-brand-error"><ArrowDownCircle size={20} /></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Saídas</p>
                    <p className="text-xl font-black text-brand-error mt-1">- R$ {formatCurrency(closingMetrics.totalSaidasInfo)}</p>
                  </div>
                </div>
              </div>

              {/* Grid de Campos Categorizados */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[50vh] overflow-y-auto custom-scrollbar pr-4">

                {/* Coluna 1: FISICO */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Banknote size={14} className="text-brand-success" /> Conferência Balcão
                  </h3>
                  <div className="space-y-4">
                    {dynamicClosingItems.filter(i => i.group === 'FISICO').map(item => (
                      <div key={item.id} className="space-y-2">
                        <label htmlFor={`closing-${item.id}`} className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{item.label}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input id={`closing-${item.id}`} name={item.id} required={item.group === 'FISICO'} type="text" onKeyDown={handleClosingKeyDown} placeholder="0,00" className="w-full bg-slate-950 border border-slate-800 p-4 pl-10 rounded-xl text-white font-black text-lg outline-none focus:border-brand-success focus:ring-1 focus:ring-brand-success/20 transition-all" value={closingBreakdown[item.id] || ''} onChange={e => setClosingBreakdown({ ...closingBreakdown, [item.id]: e.target.value })} />
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
                        <label htmlFor={`closing-${item.id}`} className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{item.label}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input id={`closing-${item.id}`} name={item.id} type="text" onKeyDown={handleClosingKeyDown} placeholder="0,00" className="w-full bg-slate-900/50 border border-slate-800 p-3 pl-10 rounded-xl text-white font-bold text-sm outline-none focus:border-blue-500 transition-all" value={closingBreakdown[item.id] || ''} onChange={e => setClosingBreakdown({ ...closingBreakdown, [item.id]: e.target.value })} />
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
                        <label htmlFor={`closing-${item.id}`} className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{item.label}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input id={`closing-${item.id}`} name={item.id} type="text" onKeyDown={handleClosingKeyDown} placeholder="0,00" className="w-full bg-slate-900/50 border border-slate-800 p-3 pl-10 rounded-xl text-white font-bold text-sm outline-none focus:border-brand-error/50 transition-all" value={closingBreakdown[item.id] || ''} onChange={e => setClosingBreakdown({ ...closingBreakdown, [item.id]: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer com Botão de Ação */}
              <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-end items-center gap-6">
                <button type="submit" disabled={isClosingShift} className="w-full md:w-auto px-12 py-5 bg-brand-error text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-brand-error/20 hover:scale-105 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {isClosingShift ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  {isClosingShift ? 'Encerrando...' : 'Confirmar e Encerrar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AUDITORIA (AÇÃO CONFERÊNCIA) */}
      {
        auditModal.show && auditModal.session && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/98 backdrop-blur-xl p-4 animate-in fade-in overflow-y-auto">
            <div className="enterprise-card w-full max-w-6xl my-auto overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-brand-warning/30 animate-in zoom-in-95 bg-slate-900/95">

              {/* Header com Metadados do Turno (Igual ao PDV) */}
              <div className="p-6 border-b border-slate-800 bg-brand-warning/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-warning/10 rounded-2xl flex items-center justify-center text-brand-warning border border-brand-warning/20">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">Auditoria do Turno</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><UserIcon size={12} /> {auditModal.session.userName || auditModal.session.user_name}</span>
                      <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><Receipt size={12} /> Turno: #{auditModal.session.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-[10px] font-black text-brand-success uppercase flex items-center gap-1.5"><Clock size={12} /> Aberto às {new Date(auditModal.session.openingTime || auditModal.session.opening_time || '').toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setAuditModal({ show: false, session: null, bankNameCash: '', bankNameCheck: '', auditedBreakdown: {}, readOnly: false })} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form ref={auditFormRef} onSubmit={handleProcessReconciliation} className="p-8 space-y-8">

                {/* Balões de Resumo Rápido (Baseados no Conferido/Auditoria) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    const totalFisico = auditItems.filter(i => i.group === 'FISICO').reduce((sum, i) => sum + parseNumericString(auditModal.auditedBreakdown[i.id] || '0'), 0);
                    const totalEntradas = auditItems.filter(i => i.group === 'ENTRADA_INFO').reduce((sum, i) => sum + parseNumericString(auditModal.auditedBreakdown[i.id] || '0'), 0);
                    const totalSaidas = auditItems.filter(i => i.group === 'SAIDA_INFO').reduce((sum, i) => sum + parseNumericString(auditModal.auditedBreakdown[i.id] || '0'), 0);

                    return (
                      <>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-success/10 rounded-xl flex items-center justify-center text-brand-success"><Banknote size={20} /></div>
                          <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Saldo Físico em Mãos</p>
                            <p className="text-xl font-black text-white mt-1">R$ {formatCurrency(totalFisico)}</p>
                          </div>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><ArrowUpCircle size={20} /></div>
                          <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Entradas</p>
                            <p className="text-xl font-black text-white mt-1">R$ {formatCurrency(totalEntradas)}</p>
                          </div>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-error/10 rounded-xl flex items-center justify-center text-brand-error"><ArrowDownCircle size={20} /></div>
                          <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Saídas</p>
                            <p className="text-xl font-black text-brand-error mt-1">- R$ {formatCurrency(totalSaidas)}</p>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Grid de Comparação (Real vs Informado) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[50vh] overflow-y-auto custom-scrollbar pr-4">

                  {/* Grupos Categorizados */}
                  {['FISICO', 'ENTRADA_INFO', 'SAIDA_INFO'].map(group => (
                    <div key={group} className="space-y-4">
                      <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
                        {group === 'FISICO' ? <Banknote size={14} className="text-brand-success" /> : group === 'ENTRADA_INFO' ? <ArrowUpCircle size={14} className="text-brand-success" /> : <ArrowDownCircle size={14} className="text-brand-error" />}
                        {group === 'FISICO' ? 'Conferência Balcão' : group === 'ENTRADA_INFO' ? 'Detalhamento Entradas' : 'Detalhamento Saídas'}
                      </h3>
                      <div className="space-y-6">
                        {auditItems.filter(i => i.group === group).map(item => {
                          const systemVal = getSystemValue(item.id, group);
                          const informedVal = parseNumericString(auditModal.auditedBreakdown[item.id] || '0');
                          const diff = informedVal - systemVal;

                          return (
                            <div key={item.id} className="space-y-2 p-3 bg-slate-900/40 rounded-2xl border border-slate-800/50">
                              <div className="flex justify-between items-center mb-1">
                                <label htmlFor={`audit-${item.id}`} className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <item.icon size={12} className="text-slate-500" /> {item.label}
                                </label>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Sistema: R$ {formatCurrency(systemVal)}</span>
                                  {Math.abs(diff) > 0.005 && (
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${diff > 0 ? 'text-brand-warning' : 'text-brand-error'}`}>
                                      Dif: {diff > 0 ? '+' : ''} R$ {formatCurrency(diff)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600">R$</span>
                                <input
                                  id={`audit-${item.id}`}
                                  name={item.id}
                                  type="text"
                                  onKeyDown={handleAuditKeyDown}
                                  placeholder="0,00"
                                  className="w-full bg-slate-950 border border-slate-800 p-2.5 pl-8 rounded-xl text-white font-bold text-sm outline-none focus:border-brand-warning transition-all shadow-inner"
                                  value={auditModal.auditedBreakdown[item.id] || ''}
                                  onChange={e => setAuditModal({ ...auditModal, auditedBreakdown: { ...auditModal.auditedBreakdown, [item.id]: e.target.value } })}
                                  disabled={auditModal.readOnly}
                                />
                              </div>


                              {/* SELETOR DE BANCO INDIVIDUAL PARA DINHEIRO E CHEQUE */}
                              {
                                (item.id === 'physical_cash' || item.id === 'physical_check') && (
                                  <div className="mt-2 pt-2 border-t border-slate-800">
                                    <label htmlFor={item.id === 'physical_cash' ? "audit-bankCash" : "audit-bankCheck"} className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Destino {item.id === 'physical_cash' ? 'Dinheiro' : 'Cheque'}</label>
                                    <select
                                      id={item.id === 'physical_cash' ? "audit-bankCash" : "audit-bankCheck"}
                                      name={item.id === 'physical_cash' ? "bankNameCash" : "bankNameCheck"}
                                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-white font-bold text-[10px] outline-none focus:border-brand-warning"
                                      value={item.id === 'physical_cash' ? auditModal.bankNameCash : auditModal.bankNameCheck}
                                      onChange={e => setAuditModal({
                                        ...auditModal,
                                        [item.id === 'physical_cash' ? 'bankNameCash' : 'bankNameCheck']: e.target.value
                                      })}
                                      disabled={auditModal.readOnly}
                                    >
                                      <option value="">{auditModal.readOnly ? (item.id === 'physical_cash' ? auditModal.bankNameCash : auditModal.bankNameCheck) : 'SELECIONE A CONTA...'}</option>
                                      {!auditModal.readOnly && banks.map(b => <option key={b.id} value={b.name}>{(b.name || '').toUpperCase()}</option>)}
                                    </select>
                                  </div>
                                )
                              }
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Histórico Detalhado do Turno (Pedido do Usuário) */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
                    <ListChecks size={14} className="text-blue-400" /> Movimentações do Turno
                  </h3>

                  {/* Filtros */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="auditTx-description" className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Descrição</label>
                      <input
                        id="auditTx-description"
                        name="auditTx-description"
                        type="text"
                        placeholder="Filtrar por descrição..."
                        className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 transition-all"
                        value={auditTransactionFilters.description}
                        onChange={e => setAuditTransactionFilters({ ...auditTransactionFilters, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="auditTx-status" className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Status</label>
                      <select
                        id="auditTx-status"
                        name="auditTx-status"
                        className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 transition-all"
                        value={auditTransactionFilters.status}
                        onChange={e => setAuditTransactionFilters({ ...auditTransactionFilters, status: e.target.value })}
                      >
                        <option value="all">TODOS</option>
                        {(() => {
                          const uniqueStatuses = new Set<string>();
                          allFinancialRecords
                            .filter(r => r.caixa_id === auditModal.session?.id)
                            .forEach(rec => {
                              const statusInfo = getStatusInfo(rec);
                              uniqueStatuses.add(statusInfo.label);
                            });
                          return Array.from(uniqueStatuses).sort().map(status => (
                            <option key={status} value={status.toLowerCase()}>{status}</option>
                          ));
                        })()}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="auditTx-paymentTerm" className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Meio / Prazo</label>
                      <select
                        id="auditTx-paymentTerm"
                        name="auditTx-paymentTerm"
                        key={`payment-term-filter-${auditModal.session?.id}`}
                        className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 transition-all"
                        value={auditTransactionFilters.paymentTerm}
                        onChange={e => setAuditTransactionFilters({ ...auditTransactionFilters, paymentTerm: e.target.value })}
                      >
                        <option value="">TODOS</option>
                        {(() => {
                          const uniqueTerms = new Set<string>();
                          allFinancialRecords
                            .filter(r => r.caixa_id === auditModal.session?.id)
                            .forEach(rec => {
                              const term = allPaymentTerms.find(t => t.id === rec.payment_term_id || t.uuid === rec.payment_term_id);
                              let termName = term?.name || '';

                              // Se não tem payment_term mas tem liquidation_date, é À VISTA
                              if (!termName && rec.liquidation_date) {
                                termName = 'À VISTA';
                              }

                              // Mesclar "À VISTA" com "À VISTA (DINHEIRO)"
                              if (termName === 'À VISTA') {
                                termName = 'À VISTA (DINHEIRO)';
                              }

                              // Só adicionar se tiver um nome válido (não vazio e não ---)
                              if (termName && termName !== '---') {
                                uniqueTerms.add(termName);
                              }
                            });

                          return Array.from(uniqueTerms).sort().map(termName => (
                            <option key={termName} value={termName}>{termName}</option>
                          ));
                        })()}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="auditTx-nature" className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Natureza</label>
                      <select
                        id="auditTx-nature"
                        name="auditTx-nature"
                        key={`nature-filter-${auditModal.session?.id}`}
                        className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 transition-all"
                        value={auditTransactionFilters.nature}
                        onChange={e => setAuditTransactionFilters({ ...auditTransactionFilters, nature: e.target.value })}
                      >
                        <option value="all">TODAS</option>
                        <option value="ENTRADA">ENTRADA</option>
                        <option value="SAIDA">SAÍDA</option>
                      </select>
                    </div>
                  </div>

                  <div className="enterprise-card overflow-hidden border-slate-800 bg-slate-950/30">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/60 border-b border-slate-800">
                            <th className="px-4 py-3">Horário</th>
                            <th className="px-4 py-3">Parceiro</th>
                            <th className="px-4 py-3">Descrição / Lançamento</th>
                            <th className="px-4 py-3">Meio / Prazo</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            <th className="px-4 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {allFinancialRecords
                            .filter(r => r.caixa_id === auditModal.session?.id)
                            .filter(rec => {
                              const statusInfo = getStatusInfo(rec);
                              const term = allPaymentTerms.find(t => t.id === rec.payment_term_id || t.uuid === rec.payment_term_id);
                              let termName = term?.name || '';
                              // Se não tem payment_term mas tem liquidation_date, é À VISTA
                              if (!termName && rec.liquidation_date) {
                                termName = 'À VISTA';
                              }
                              // Normalizar À VISTA para À VISTA (DINHEIRO)
                              if (termName === 'À VISTA') {
                                termName = 'À VISTA (DINHEIRO)';
                              }

                              // Filtro de descrição
                              const matchDescription = !auditTransactionFilters.description ||
                                normalizeText(rec.description).includes(normalizeText(auditTransactionFilters.description));

                              // Filtro de status (agora comparando com o label em lowercase)
                              const matchStatus = auditTransactionFilters.status === 'all' ||
                                normalizeText(statusInfo.label) === normalizeText(auditTransactionFilters.status);

                              // Filtro de meio/prazo (comparação exata agora)
                              const matchPaymentTerm = !auditTransactionFilters.paymentTerm ||
                                termName === auditTransactionFilters.paymentTerm;

                              // Filtro de natureza
                              const matchNature = auditTransactionFilters.nature === 'all' ||
                                rec.natureza === auditTransactionFilters.nature;

                              return matchDescription && matchStatus && matchPaymentTerm && matchNature;
                            })
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map(rec => {
                              const statusInfo = getStatusInfo(rec);
                              const partner = partners.find(p => p.id === rec.parceiro_id);
                              const term = allPaymentTerms.find(t => t.id === rec.payment_term_id || t.uuid === rec.payment_term_id);
                              let displayTerm = term?.name || '';
                              // Se não tem payment_term mas tem liquidation_date, é À VISTA
                              if (!displayTerm && rec.liquidation_date) {
                                displayTerm = 'À VISTA';
                              }
                              // Normalizar À VISTA para À VISTA (DINHEIRO) na exibição
                              if (displayTerm === 'À VISTA') {
                                displayTerm = 'À VISTA (DINHEIRO)';
                              }
                              // Se não tem nada, mostrar ---
                              if (!displayTerm) {
                                displayTerm = '---';
                              }
                              return (
                                <tr key={rec.id} className={`text-[10px] hover:bg-slate-800/40 transition-colors ${statusInfo.isStriked ? 'opacity-40 grayscale line-through' : ''}`}>
                                  <td className="px-4 py-3 font-mono text-slate-500">{new Date(rec.created_at).toLocaleTimeString()}</td>
                                  <td className="px-4 py-3 text-slate-400 font-bold uppercase truncate max-w-[120px]">{partner?.name || '---'}</td>
                                  <td className="px-4 py-3 text-slate-300 font-medium uppercase truncate max-w-xs">{rec.description}</td>
                                  <td className="px-4 py-3 text-slate-500 font-black uppercase tracking-tighter">{displayTerm}</td>
                                  <td className={`px-4 py-3 text-right font-black ${rec.natureza === 'ENTRADA' ? 'text-brand-success' : 'text-brand-error'}`}>
                                    {rec.natureza === 'SAIDA' ? '- ' : ''}R$ {formatCurrency(rec.valor)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 ${statusInfo.color}`}>{statusInfo.label}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          {allFinancialRecords.filter(r => r.caixa_id === auditModal.session?.id).length === 0 && (
                            <tr><td colSpan={6} className="py-10 text-center text-slate-600 italic uppercase font-bold text-[9px]">Nenhuma movimentação para este turno</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Destino BancÃ¡rio e BotÃ£o de Ação */}
                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-end gap-6">
                  {/* Destino Bancário removido do footer pois agora é individual por item físico */}

                  {auditModal.session?.status === 'reconciled' ? (
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                      <div className="px-8 py-4 bg-slate-800/50 rounded-xl border border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck size={16} className="text-brand-success" /> Turno já Reconciliado pelo Auditor em {new Date(auditModal.session.reconciledAt || (auditModal.session as any).reconciled_at || '').toLocaleDateString()}
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestReverseReconciliation}
                        className="px-6 py-4 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:text-white flex items-center gap-2"
                      >
                        <Trash2 size={16} /> Estornar Conferência
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isAuditing || auditModal.readOnly}
                      className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 ${auditModal.readOnly
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-brand-warning text-black shadow-brand-warning/20 hover:scale-105 active:scale-95'
                        }`}
                    >
                      {isAuditing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      {isAuditing ? 'Efetivando...' : 'Efetivar Auditoria do Turno'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div >
        )
      }

      {/* MODAL LANÃ‡AMENTO MANUAL CARTEIRA */}
      {
        showWalletManualEntry && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
            <div className="enterprise-card w-full max-md overflow-hidden shadow-2xl border-blue-500/30 animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-800 bg-blue-500/5 flex justify-between items-center">
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3"><PlusCircle className="text-blue-400" /> Lançamento Bancário</h2>
                <button onClick={() => {
                  setShowWalletManualEntry(false);
                  setWalletForm({ tipo: 'ENTRADA', valor: '', categoria: '', parceiro: '', payment_term_id: '', descricao: '', id: '' });
                }}><X size={24} className="text-slate-500" /></button>
              </div>
              <form onSubmit={handleWalletManualSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setWalletForm({ ...walletForm, tipo: 'ENTRADA' })} className={`py-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm ${walletForm.tipo === 'ENTRADA' ? 'bg-brand-success text-white border-brand-success shadow-brand-success/20' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Entrada (+)</button>
                  <button type="button" onClick={() => setWalletForm({ ...walletForm, tipo: 'SAIDA' })} className={`py-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm ${walletForm.tipo === 'SAIDA' ? 'bg-brand-error text-white border-brand-error shadow-brand-error/20' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Saída (-)</button>
                </div>
                <div className="space-y-2">
                  <label htmlFor="wallet-valor" className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">Valor do Lançamento</label>
                  <input id="wallet-valor" name="valor" required placeholder="0,00" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white font-black text-3xl text-center outline-none focus:border-blue-400 transition-all shadow-inner" value={walletForm.valor} onChange={e => setWalletForm({ ...walletForm, valor: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="wallet-parceiro" className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Conta Bancária</label>
                    <select id="wallet-parceiro" name="parceiro" required className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={walletForm.parceiro} onChange={e => setWalletForm({ ...walletForm, parceiro: e.target.value })}>
                      <option value="">BANCO / CONTA...</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="wallet-paymentTermId" className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Meio de Pagamento</label>
                    <select id="wallet-paymentTermId" name="payment_term_id" required className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={walletForm.payment_term_id} onChange={e => setWalletForm({ ...walletForm, payment_term_id: e.target.value })}>
                      <option value="">FORMA...</option>
                      {bankManualTerms.map(t => <option key={t.id} value={t.id || t.uuid}>{t.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="wallet-categoria" className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Classificação Categoria</label>
                  <select id="wallet-categoria" name="categoria" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={walletForm.categoria} onChange={e => setWalletForm({ ...walletForm, categoria: e.target.value })}>
                    <option value="">SELECIONE A CATEGORIA...</option>
                    {filteredWalletCategories.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="wallet-descricao" className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Descrição Operacional</label>
                  <textarea id="wallet-descricao" name="descricao" placeholder="..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs resize-none outline-none focus:border-blue-400" rows={2} value={walletForm.descricao} onChange={e => setWalletForm({ ...walletForm, descricao: e.target.value })} />
                </div>
                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 size={20} />
                  Efetivar Lançamento
                </button>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL AUTH DELETE */}
      <RequestAuthorizationModal
        isOpen={isRequestDeleteAuthModalOpen}
        onClose={() => setIsRequestDeleteAuthModalOpen(false)}
        actionKey="CANCELAR_TRANSACAO_CARTEIRA"
        actionLabel={`Solicitação para CANCELAR Transação ID: ${txToAuthorize?.id || txToAuthorize?.uuid}`}
        details={`Transação: ${txToAuthorize?.descricao} | Valor: R$ ${(txToAuthorize?.valor_entrada || 0) + (txToAuthorize?.valor_saida || 0)}`}
      />

      {/* MODAL AUTH MANUAL ENTRY/EDIT COMMIT */}
      <RequestAuthorizationModal
        isOpen={isRequestManualAuthModalOpen}
        onClose={() => setIsRequestManualAuthModalOpen(false)}
        onSuccess={() => {
          setShowWalletManualEntry(false);
          setWalletForm({ tipo: 'ENTRADA', valor: '', categoria: '', parceiro: '', payment_term_id: '', descricao: '', id: '' });
        }}
        actionKey="LANCAMENTO_MANUAL_CARTEIRA"
        actionLabel={`Lançamento: ${manualEntryToAuthorize?.descricao} | JSON: ${JSON.stringify(manualEntryToAuthorize)}`}
        details={`Tipo: ${manualEntryToAuthorize?.tipo} | Valor: R$ ${formatCurrency(manualEntryToAuthorize?.valor || 0)} | Desc: ${manualEntryToAuthorize?.descricao}`}
      />

      {/* MODAL AUTH REVERSE LIQUIDATION */}
      <RequestAuthorizationModal
        isOpen={isRequestReverseLiquidationAuthModalOpen}
        onClose={() => setIsRequestReverseLiquidationAuthModalOpen(false)}
        actionKey="ESTORNAR_LIQUIDACAO"
        actionLabel={`Solicitação para ESTORNAR Liquidação ID: ${recordToReverse?.id}`}
        details={`Estorno de Baixa: ${recordToReverse?.description} | Valor Original: R$ ${formatCurrency(recordToReverse?.valor)} | Data Liq: ${recordToReverse?.liquidation_date ? formatBRDate(recordToReverse.liquidation_date) : 'Hoje'}`}
      />

      {/* MODAL AUTH EDIT COMMIT */}
      <RequestAuthorizationModal
        isOpen={isRequestEditLiquidationAuthModalOpen}
        onClose={() => setIsRequestEditLiquidationAuthModalOpen(false)}
        onSuccess={() => {
          setShowNewTitleModal(false);
          setPendingEditPayload(null);
        }}
        actionKey="SALVAR_EDICAO_FINANCEIRO"
        actionLabel={`Alteração de Lançamento Manual ID: ${pendingEditPayload?.id}`}
        details={(pendingEditPayload as any)?._authDetails || `Lançamento: ${pendingEditPayload?.description} | Novo Valor: R$ ${formatCurrency(pendingEditPayload?.valor)}`}
      />

      {/* MODAL AUTH AUDIT REVERSAL */}
      <RequestAuthorizationModal
        isOpen={isRequestReverseAuditAuthModalOpen}
        onClose={() => setIsRequestReverseAuditAuthModalOpen(false)}
        actionKey="ESTORNAR_AUDITORIA"
        actionLabel={`Solicitação para ESTORNAR Auditoria TURNO: ${auditToReverse?.id}`}
        details={`Reabertura de Turno Auditado #${auditToReverse?.id.slice(0, 6).toUpperCase()} | Operador: ${auditToReverse?.userName}`}
      />

      {/* MODAL AUTH DELETE LIQUIDATION */}
      <RequestAuthorizationModal
        isOpen={isRequestDeleteLiquidationAuthModalOpen}
        onClose={() => setIsRequestDeleteLiquidationAuthModalOpen(false)}
        actionKey="EXCLUIR_LIQUIDACAO"
        actionLabel={`Solicitação para EXCLUIR Lançamento Manual ID: ${recordToDelete?.id}`}
        details={`Lançamento: ${recordToDelete?.description} | Valor: R$ ${formatCurrency(recordToDelete?.valor)} | Vencimento: ${recordToDelete?.due_date ? formatBRDate(recordToDelete.due_date) : 'N/A'}`}
      />
    </div >
  );
};

export default FinanceHub;

