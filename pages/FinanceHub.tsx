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
  Calendar, Eye, Trash2, Edit, RotateCcw
} from 'lucide-react';
import { TableLayout } from '../components/FinanceTableLayout';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import { authorizationService } from '../services/authorizationService';

const parseNumericString = (val: string) => {
  if (!val) return 0;
  const clean = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
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

  // Authorization State
  const [isRequestEditAuthModalOpen, setIsRequestEditAuthModalOpen] = useState(false);
  const [isRequestDeleteAuthModalOpen, setIsRequestDeleteAuthModalOpen] = useState(false);
  const [txToAuthorize, setTxToAuthorize] = useState<WalletTransaction | null>(null);
  const [manualEntryToAuthorize, setManualEntryToAuthorize] = useState<any>(null);
  const [isRequestManualAuthModalOpen, setIsRequestManualAuthModalOpen] = useState(false);
  const [isRequestReverseAuthModalOpen, setIsRequestReverseAuthModalOpen] = useState(false);
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

  const parseNumericString = (str: string): number => {
    if (!str) return 0;
    if (typeof str === 'number') return str;
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const client = db.getCloudClient();

    try {
      const allPartners = db.queryTenant<Partner>('partners', companyId);

      // FILTRAGEM RIGOROSA DE TERMOS PARA O HUB (POLÃTICA ENTERPRISE)
      const allTermsRaw = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);

      const pTerms = allTermsRaw.filter((t: PaymentTerm) =>
      ((t.show_in_settle === true || (t as any).showInSettle === true) &&
        (t.show_in_purchase === true || (t as any).showInPurchase === true))
      );

      const sTerms = allTermsRaw.filter((t: PaymentTerm) =>
      ((t.show_in_settle === true || (t as any).showInSettle === true) &&
        (t.show_in_sale === true || (t as any).showInSale === true))
      );

      // Termos permitidos para o Hub (Extrato/Geral)
      const hTerms = allTermsRaw.filter((t: PaymentTerm) =>
      (t.show_in_settle === true || (t as any).showInSettle === true ||
        t.show_in_bank_manual === true || (t as any).showInBankManual === true)
      );

      // Termos ESPECÃFICOS para LanÃ§amento BancÃ¡rio Manual (Pedido do UsuÃ¡rio)
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
        const { data: finData } = await client.from('financials').select('*').eq('company_id', companyId);
        if (finData) setAllFinancialRecords(finData.map(db.normalize));

        const { data: walletData } = await client.from('wallet_transactions').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
        if (walletData) setWalletTransactions(walletData.map(db.normalize));

        const { data: sessionData } = await client.from('cashier_sessions').select('*').eq('company_id', companyId).order('opening_time', { ascending: false });
        if (sessionData) {
          const normSessions = sessionData.map(db.normalize);
          setCashierSessions(normSessions);
          const myActive = normSessions.find(s => (s.userId === currentUser?.id || s.user_id === currentUser?.id) && s.status === 'open');
          setActiveSession(myActive || null);
        }
      } else {
        setAllFinancialRecords(db.queryTenant<FinancialRecord>('financials', companyId));
        setWalletTransactions(db.queryTenant<WalletTransaction>('walletTransactions' as any, companyId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        const sessions = db.queryTenant<CashierSession>('cashierSessions', companyId);
        setCashierSessions(sessions);
        const myActive = sessions.find(s => (s.userId === currentUser?.id || s.user_id === currentUser?.id) && s.status === 'open');
        setActiveSession(myActive || null);
      }
    } catch (err: any) {
      console.error("Erro ao sincronizar Hub Financeiro:", err.message || err);
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
          }
          // Mark as PROCESSED to avoid re-triggering
          await db.update('authorization_requests' as any, req.id, { status: 'PROCESSED' } as any);
          refreshRequests();
        } catch (e) { console.error("Error processing auth request", e); }
      });
    }
  }, [pendingRequests, currentUser, walletTransactions]);

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



  const filteredWallet = useMemo(() => {
    return walletTransactions.filter(t => {
      const tDate = (t.created_at || '').substring(0, 10);
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
      const rDate = (r.dueDate || r.due_date || r.created_at || '').substring(0, 10);
      const matchDate = rDate >= dateStart && rDate <= dateEnd;
      if (!matchDate) return false;

      const partner = partners.find(p => p.id === r.parceiro_id);
      const matchesSearch =
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (partner?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'ALL' || r.natureza === filterType;

      const matchesSession = !filterSession || (r.caixa_id || '').toLowerCase().includes(filterSession.toLowerCase());
      const matchesStatus = !filterStatus || status.label === filterStatus;
      const matchesPartner = !filterPartner || (partner?.name || '').toLowerCase().includes(filterPartner.toLowerCase());

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
      const sDate = (s.openingTime || s.opening_time || '').substring(0, 10);
      const matchDate = sDate >= auditDateStart && sDate <= auditDateEnd;
      const matchOperator = auditOperatorFilter === 'all' || s.userId === auditOperatorFilter || s.user_id === auditOperatorFilter;
      const matchSessionId = !auditFilterSessionId || (s.id || '').toLowerCase().includes(auditFilterSessionId.toLowerCase());
      const matchStatus = auditFilterStatus === 'all' || s.status === auditFilterStatus;

      return matchDate && matchOperator && matchSessionId && matchStatus;
    });
  }, [cashierSessions, auditDateStart, auditDateEnd, auditOperatorFilter, auditFilterSessionId, auditFilterStatus]);

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

      // Excluir À VISTA (DINHEIRO)
      if (term.name === 'À VISTA (DINHEIRO)' || term.name === 'À VISTA') return;

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
        group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO',
        icon: value.natureza === 'ENTRADA' ? ArrowUpCircle : ArrowDownCircle
      });
    });

    // Adicionar payment terms ao array de items
    termMap.forEach((value, key) => {
      const termName = key.replace(`term_`, '').replace(`_${value.natureza}`, '');
      items.push({
        id: key,
        label: `${termName.toUpperCase()}`,
        group: value.natureza === 'ENTRADA' ? 'ENTRADA_INFO' : 'SAIDA_INFO',
        icon: CreditCard
      });
    });

    return items;
  }, [auditModal.session, companyId, allPaymentTerms]);

  const executeWalletManualSubmit = async (data: any) => {
    try {
      const amount = parseNumericString(data.valor);
      const lastBalance = walletTransactions[0]?.saldo_real || 0;
      const isEntry = data.tipo === 'ENTRADA';

      // Re-find term just in case, or use ID directly
      // Assuming data.payment_term_id is the correct ID/UUID

      await db.insert<WalletTransaction>('walletTransactions' as any, {
        company_id: companyId!,
        user_id: currentUser?.id,
        categoria: data.categoria,
        parceiro: data.parceiro,
        payment_term_id: data.payment_term_id,
        descricao: data.descricao.toUpperCase() || `LANÇAMENTO MANUAL ${data.tipo}`,
        valor_entrada: isEntry ? amount : 0,
        valor_saida: isEntry ? 0 : amount,
        saldo_real: isEntry ? lastBalance + amount : lastBalance - amount,
        created_at: db.getNowISO()
      });

      if (data.id) {
        await db.delete('walletTransactions', data.id);
      }

      setShowWalletManualEntry(false);
      setWalletForm({ tipo: 'ENTRADA', valor: '', categoria: '', parceiro: '', payment_term_id: '', descricao: '', id: '' });
      triggerRefresh();
    } catch (err: any) {
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
        return alert(`Saldo insuficiente na conta selecionada.\nSaldo Atual: R$ ${currentBankBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
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
      valor: (isEntry ? t.valor_entrada : t.valor_saida).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      categoria: t.categoria || '',
      parceiro: t.parceiro || '',
      payment_term_id: t.payment_term_id || '',
      descricao: t.descricao || ''
    });
    setShowWalletManualEntry(true);
  };

  const handleProcessLiquidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liquidationModal.record || !activeSession || isLiquidating) return;
    setIsLiquidating(true);
    try {
      await db.update('financials', liquidationModal.record.id, {
        status: 'paid',
        paymentTermId: liquidationModal.termId,
        liquidation_date: db.getNowISO(),
        due_date: liquidationModal.dueDate,
        caixa_id: activeSession.id
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
      const termDinheiro = allHubTerms.find(t => t.name.toUpperCase().includes('DINHEIRO'));
      const termCheque = allHubTerms.find(t => t.name.toUpperCase().includes('CHEQUE'));

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

  const handleReverseReconciliation = async () => {
    const { session } = auditModal;
    if (!session) return;

    if (!confirm(`Tem certeza que deseja ESTORNAR a conferência do turno #${session.id.slice(0, 6).toUpperCase()}? \n\nIsso irá:\n1. Reabrir o turno para conferência.\n2. Excluir os depósitos gerados no Extrato Bancário.`)) return;

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

    // 4. Apply View Filters (Search, etc.)
    let filtered = computed;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        (t.descricao || '').toLowerCase().includes(lower) ||
        (t.parceiro || '').toLowerCase().includes(lower) ||
        (t.operador_name || '').toLowerCase().includes(lower) ||
        (t.forma || '').toLowerCase().includes(lower)
      );
    }

    // 5. Reverse for Display (Newest First)
    return filtered.reverse();
  }, [walletTransactions, walletFilterBanco, searchTerm]);

  const walletMetrics = useMemo(() => {
    // Filter dynamicWalletData (already sorted/computed/reversed) by DATE
    const inPeriod = dynamicWalletData.filter(t => {
      const tDate = (t.created_at || '').substring(0, 10);
      return tDate >= dateStart && tDate <= dateEnd;
    });

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
      <header className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Wallet className="text-brand-success" size={28} /> Hub Financeiro
          </h1>
          <p className="text-slate-400 text-[10px] md:text-sm mt-1 font-medium uppercase tracking-widest leading-relaxed">Movimentações operacionais e liquidez cloud.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="enterprise-card px-4 py-2 flex items-center gap-3 border-slate-800 bg-slate-900/50">
            <Landmark size={16} className="text-blue-400" />
            <div className="hidden sm:block">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Saldo Bancário</p>
              <p className="text-sm font-black text-white">R$ {stats.currentWalletBalance.toLocaleString()}</p>
            </div>
          </div>
          <button onClick={triggerRefresh} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all">
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

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

      {/* MODAL BAIXAS */}
      {activeModal === 'baixas' && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in duration-200">
          <header className="bg-brand-card border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 no-print gap-4">
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
                <input type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                <span className="text-slate-600 font-bold text-[9px]">ATÉ</span>
                <input type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input type="text" placeholder="Filtrar títulos..." className="w-full bg-slate-900 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-white font-bold text-xs outline-none focus:border-brand-success" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Turno ID..."
                  className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-24"
                  value={filterSession}
                  onChange={e => setFilterSession(e.target.value)}
                />

                <select
                  className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="">TODOS STATUS</option>
                  <option value="ABERTO">ABERTO</option>
                  <option value="ATRASADO">ATRASADO</option>
                </select>

                <input
                  type="text"
                  list="partner-list-options"
                  placeholder="Filtrar Parceiro..."
                  className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-32"
                  value={filterPartner}
                  onChange={e => setFilterPartner(e.target.value)}
                />
                <datalist id="partner-list-options">
                  {partners.map(p => <option key={p.id} value={p.name.toUpperCase()} />)}
                </datalist>

                <button onClick={() => setActiveModal(null)} className="hidden md:flex p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all items-center gap-2 px-3 md:px-4">
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Fechar</span>
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-3 md:p-8 bg-brand-dark custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <div className="enterprise-card p-5 border-l-4 border-l-brand-success bg-brand-success/5 shadow-lg">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">A Receber (Aberto)</p>
                  <h3 className="text-xl font-black text-white">R$ {baixasMetrics.abertoIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-success"><TrendingUp size={12} /><span className="text-[8px] font-bold uppercase">Projeção de Entrada</span></div>
                </div>
                <div className="enterprise-card p-5 border-l-4 border-l-brand-error bg-brand-error/5 shadow-lg">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">A Pagar (Aberto)</p>
                  <h3 className="text-xl font-black text-white">R$ {baixasMetrics.abertoOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-error"><TrendingDown size={12} /><span className="text-[8px] font-bold uppercase">Projeção de Saída</span></div>
                </div>
                <div className="enterprise-card p-5 border-l-4 border-l-brand-error bg-brand-error/20 shadow-lg">
                  <p className="text-[9px] font-black text-brand-error uppercase tracking-widest mb-1">Atrasados (Saídas)</p>
                  <h3 className="text-xl font-black text-white">R$ {baixasMetrics.atrasadoOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-error animate-pulse"><AlertTriangle size={12} /><span className="text-[8px] font-bold uppercase">Vencidos em Aberto</span></div>
                </div>
                <div className="enterprise-card p-5 border-l-4 border-l-brand-warning bg-brand-warning/10 shadow-lg">
                  <p className="text-[9px] font-black text-brand-warning uppercase tracking-widest mb-1">Atrasados (Entradas)</p>
                  <h3 className="text-xl font-black text-white">R$ {baixasMetrics.atrasadoIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-brand-warning"><AlertCircle size={12} /><span className="text-[8px] font-bold uppercase">Crédito Pendente</span></div>
                </div>
              </div>

              <div className="flex justify-end no-print mb-4">
                <select className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-black text-[10px] uppercase outline-none focus:border-brand-success" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                  <option value="ALL">TODAS NATUREZAS</option>
                  <option value="ENTRADA">SOMENTE ENTRADAS</option>
                  <option value="SAIDA">SOMENTE SAÃDAS</option>
                </select>
              </div>

              {(filterType === 'ALL' || filterType === 'ENTRADA') && (
                <TableLayout
                  title="A Receber (Vendas e Entradas)"
                  items={filteredItems.filter(f => f.natureza === 'ENTRADA')}
                  icon={ArrowUpCircle}
                  iconColor="text-brand-success"
                  partners={partners}
                  activeSession={activeSession}
                  isLiquidating={isLiquidating}
                  setLiquidationModal={setLiquidationModal}
                />
              )}
              {(filterType === 'ALL' || filterType === 'SAIDA') && (
                <TableLayout
                  title="A Pagar (Compras e Despesas)"
                  items={filteredItems.filter(f => f.natureza === 'SAIDA')}
                  icon={ArrowDownCircle}
                  iconColor="text-brand-error"
                  partners={partners}
                  activeSession={activeSession}
                  isLiquidating={isLiquidating}
                  setLiquidationModal={setLiquidationModal}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {/* MODAL CONFERÊNCIA */}
      {activeModal === 'conferencia' && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in duration-200">
          <header className="bg-brand-card border-b border-slate-800 p-4 flex items-center justify-between shrink-0 no-print">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-warning/10 flex items-center justify-center text-brand-warning border border-brand-warning/20">
                <ShieldCheck size={18} />
              </div>
              <h2 className="text-xs md:text-lg font-black text-white uppercase tracking-tighter">Auditoria de Turnos</h2>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 items-center justify-center gap-2 w-full md:w-auto">
                <input type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={auditDateStart} onChange={e => setAuditDateStart(e.target.value)} />
                <span className="text-slate-600 font-bold text-[9px]">ATÉ</span>
                <input type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={auditDateEnd} onChange={e => setAuditDateEnd(e.target.value)} />
              </div>

              <input
                type="text"
                placeholder="Turno ID..."
                className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success w-24"
                value={auditFilterSessionId}
                onChange={e => setAuditFilterSessionId(e.target.value)}
              />

              <select
                className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success"
                value={auditFilterStatus}
                onChange={e => setAuditFilterStatus(e.target.value)}
              >
                <option value="all">TODOS STATUS</option>
                <option value="open">ABERTO</option>
                <option value="closed">FECHADO</option>
                <option value="reconciled">CONFERIDO</option>
              </select>

              <select
                className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-brand-success"
                value={auditOperatorFilter}
                onChange={e => setAuditOperatorFilter(e.target.value)}
              >
                <option value="all">TODOS OPERADORES</option>
                {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
              </select>

              <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all flex items-center gap-2 px-3 md:px-4">
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
                        <th className="px-6 py-5">Turno (PDV)</th>
                        <th className="px-6 py-5">Início do Turno</th>
                        <th className="px-6 py-5">Operador</th>
                        <th className="px-6 py-5">Auditor</th>
                        <th className="px-6 py-5 text-right">Saldo Físico</th>
                        <th className="px-6 py-5 text-center">Status</th>
                        <th className="px-6 py-5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {filteredSessions.map(session => (
                        <tr key={session.id} className="hover:bg-slate-800/20 transition-all text-xs">
                          <td className="px-6 py-4 font-mono text-slate-500 font-bold">#{session.id.slice(0, 8).toUpperCase()}</td>
                          <td className="px-6 py-4 font-mono text-slate-400 font-bold">{new Date(session.openingTime || session.opening_time || '').toLocaleString()}</td>
                          <td className="px-6 py-4 font-black uppercase text-slate-200">{session.userName || session.user_name}</td>
                          <td className="px-6 py-4 font-black uppercase text-brand-success/80 text-[10px]">{session.reconciledByName || session.reconciled_by_name || '-'}</td>
                          <td className="px-6 py-4 text-right font-black text-white">R$ {(session.closingBalance || session.closing_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border shadow-sm ${session.status === 'open' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                              session.status === 'closed' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                              {session.status === 'open' ? 'Em Aberto' : session.status === 'closed' ? 'Aguardando Conferência' : 'Conferido'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setAuditModal({
                                  show: true,
                                  session,
                                  bankNameCash: session.status === 'reconciled' ? 'RECONCILIADO' : '',
                                  bankNameCheck: session.status === 'reconciled' ? 'RECONCILIADO' : '',
                                  auditedBreakdown: (session.reconciledBreakdown || session.reconciled_breakdown || session.physicalBreakdown || session.physical_breakdown || {}) as any,
                                  readOnly: true
                                })}
                                className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700/50 hover:border-slate-600 shadow-sm"
                                title="Visualizar Detalhes"
                              >
                                <Eye size={16} />
                              </button>
                              {session.status === 'closed' && (
                                <button onClick={() => setAuditModal({ show: true, session, bankNameCash: '', bankNameCheck: '', auditedBreakdown: (session.physicalBreakdown || session.physical_breakdown || {}) as any })} className="px-5 py-2 bg-brand-warning text-black rounded-xl font-black uppercase text-[10px] shadow-lg shadow-brand-warning/20 hover:scale-105 transition-all whitespace-nowrap">Conferir Turno</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredSessions.length === 0 && (
                        <tr><td colSpan={5} className="py-20 text-center text-slate-600 italic uppercase font-bold text-[10px]">Nenhum turno localizado para auditoria</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
      {/* MODAL CARTEIRA (Bancos) */}
      {
        activeModal === 'carteira' && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in duration-200">
            <header className="bg-brand-card border-b border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 no-print gap-4">
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
                  <input type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                  <span className="text-slate-600 font-bold text-[9px]">ATÉ</span>
                  <input type="date" className="bg-slate-950 p-1 text-[9px] font-black text-white w-full md:w-auto rounded outline-none [color-scheme:dark]" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input type="text" placeholder="Filtrar..." className="w-full bg-slate-900 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>

                <select
                  className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 max-w-[150px]"
                  value={walletFilterBanco}
                  onChange={e => setWalletFilterBanco(e.target.value)}
                >
                  <option value="">TODOS BANCOS</option>
                  {banks.map(b => <option key={b.id} value={b.name}>{b.name.toUpperCase()}</option>)}
                </select>

                <button onClick={() => setShowWalletManualEntry(true)} className="w-full md:w-auto bg-brand-success text-white px-5 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-brand-success/20 hover:scale-105 transition-all">Novo Lançamento</button>

                <button onClick={() => setActiveModal(null)} className="hidden md:flex p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all items-center gap-2 px-3 md:px-4">
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Fechar</span>
                  <X size={18} />
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-3 md:p-8 bg-brand-dark custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-6">

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                  <div className="enterprise-card p-5 border-l-4 border-l-brand-success bg-brand-success/5 shadow-lg">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Entradas (Período)</p>
                    <h3 className="text-xl font-black text-white">R$ {walletMetrics.totalEntrada.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                    <div className="flex items-center gap-1.5 mt-2 text-brand-success"><ArrowUpCircle size={12} /><span className="text-[8px] font-bold uppercase">Créditos Confirmados</span></div>
                  </div>
                  <div className="enterprise-card p-5 border-l-4 border-l-brand-error bg-brand-error/5 shadow-lg">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Saídas (Período)</p>
                    <h3 className="text-xl font-black text-white">R$ {walletMetrics.totalSaida.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                    <div className="flex items-center gap-1.5 mt-2 text-brand-error"><ArrowDownCircle size={12} /><span className="text-[8px] font-bold uppercase">Débitos Realizados</span></div>
                  </div>
                  <div className={`enterprise-card p-5 border-l-4 shadow-lg ${walletMetrics.result >= 0 ? 'border-l-blue-500 bg-blue-500/5' : 'border-l-brand-warning bg-brand-warning/5'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${walletMetrics.result >= 0 ? 'text-blue-400' : 'text-brand-warning'}`}>Resultado do Período</p>
                    <h3 className="text-xl font-black text-white">R$ {walletMetrics.result.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                    <div className={`flex items-center gap-1.5 mt-2 ${walletMetrics.result >= 0 ? 'text-blue-400' : 'text-brand-warning'}`}><Scale size={12} /><span className="text-[8px] font-bold uppercase">Balanço do Filtro</span></div>
                  </div>
                  <div className="enterprise-card p-5 border-l-4 border-l-slate-600 bg-slate-800/30 shadow-lg">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Final (no Filtro)</p>
                    <h3 className="text-xl font-black text-white">{walletMetrics.finalBalance !== null ? `R$ ${walletMetrics.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---'}</h3>
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
                              <td className={`px-6 py-4 font-black uppercase text-slate-200 ${isCancelled ? 'line-through' : ''}`}>{bank ? bank.name : t.parceiro}</td>
                              <td className="px-6 py-4">
                                <p className={`text-slate-300 uppercase font-medium whitespace-normal break-words ${isCancelled ? 'line-through' : ''}`}>{t.descricao} {isCancelled && <span className="text-red-500 font-bold ml-2">(CANCELADO)</span>}</p>
                                <p className={`text-[9px] text-slate-500 uppercase font-bold tracking-tighter ${isCancelled ? 'line-through' : ''}`}>{term?.name || t.forma || 'Lançamento Direto'}</p>
                              </td>
                              <td className={`px-6 py-4 uppercase text-[10px] font-black ${isCancelled ? 'line-through text-slate-500' : 'text-brand-success/80'}`}>
                                {operator ? operator.name : (t.operador_name || 'Sistema')}
                              </td>
                              <td className={`px-6 py-4 text-right font-black ${isCancelled ? 'line-through text-slate-500' : 'text-brand-success'}`}>{t.valor_entrada > 0 ? `R$ ${t.valor_entrada.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                              <td className={`px-6 py-4 text-right font-black ${isCancelled ? 'line-through text-slate-500' : 'text-brand-error'}`}>{t.valor_saida > 0 ? `R$ ${t.valor_saida.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                              <td className="px-6 py-4 text-right font-black text-white bg-slate-800/20">{isCancelled ? '---' : `R$ ${t.computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td>
                              <td className="px-6 py-4 text-center">
                                {!isCancelled && (
                                  <div className="flex items-center justify-center gap-2">
                                    {isSystem ? (
                                      !isOpening && <button onClick={() => handleReverseSystemTransaction(t)} className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-all" title="Estornar Conferência"><RotateCcw size={14} /></button>
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
                    <p className="text-brand-success font-black text-3xl">R$ {liquidationModal.record.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${liquidationModal.record.natureza === 'ENTRADA' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' : 'bg-brand-error/10 text-brand-error border-brand-error/20'}`}>{liquidationModal.record.natureza}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Meio de Pagamento (Destino/Origem)</label>
                  <select
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
                      setLiquidationModal({ ...liquidationModal, termId: selId, dueDate: calcDate.toISOString().split('T')[0] });
                    }}
                  >
                    <option value="">SELECIONE O MEIO DE PAGAMENTO...</option>
                    {(liquidationModal.record.natureza === 'SAIDA' ? purchasePaymentTerms : salePaymentTerms).map(t => <option key={t.id} value={t.id || t.uuid}>{t.name.toUpperCase()}</option>)}
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
                            <p className="text-xl font-black text-white mt-1">R$ {totalFisico.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><ArrowUpCircle size={20} /></div>
                          <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Entradas</p>
                            <p className="text-xl font-black text-white mt-1">R$ {totalEntradas.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-error/10 rounded-xl flex items-center justify-center text-brand-error"><ArrowDownCircle size={20} /></div>
                          <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalhamento Saídas</p>
                            <p className="text-xl font-black text-brand-error mt-1">- R$ {totalSaidas.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <item.icon size={12} className="text-slate-500" /> {item.label}
                                </label>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Sistema: R$ {systemVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  {Math.abs(diff) > 0.01 && (
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${diff > 0 ? 'text-brand-warning' : 'text-brand-error'}`}>
                                      Dif: {diff > 0 ? '+' : ''} R$ {diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600">R$</span>
                                <input
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
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Destino {item.id === 'physical_cash' ? 'Dinheiro' : 'Cheque'}</label>
                                    <select
                                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-white font-bold text-[10px] outline-none focus:border-brand-warning"
                                      value={item.id === 'physical_cash' ? auditModal.bankNameCash : auditModal.bankNameCheck}
                                      onChange={e => setAuditModal({
                                        ...auditModal,
                                        [item.id === 'physical_cash' ? 'bankNameCash' : 'bankNameCheck']: e.target.value
                                      })}
                                      disabled={auditModal.readOnly}
                                    >
                                      <option value="">{auditModal.readOnly ? (item.id === 'physical_cash' ? auditModal.bankNameCash : auditModal.bankNameCheck) : 'SELECIONE A CONTA...'}</option>
                                      {!auditModal.readOnly && banks.map(b => <option key={b.id} value={b.name}>{b.name.toUpperCase()}</option>)}
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
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Descrição</label>
                      <input
                        type="text"
                        placeholder="Filtrar por descrição..."
                        className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-400 transition-all"
                        value={auditTransactionFilters.description}
                        onChange={e => setAuditTransactionFilters({ ...auditTransactionFilters, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Status</label>
                      <select
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
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Meio / Prazo</label>
                      <select
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
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Natureza</label>
                      <select
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
                                rec.description.toLowerCase().includes(auditTransactionFilters.description.toLowerCase());

                              // Filtro de status (agora comparando com o label em lowercase)
                              const matchStatus = auditTransactionFilters.status === 'all' ||
                                statusInfo.label.toLowerCase() === auditTransactionFilters.status;

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
                                    {rec.natureza === 'SAIDA' ? '- ' : ''}R$ {rec.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                        onClick={handleReverseReconciliation}
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
                <button onClick={() => setShowWalletManualEntry(false)}><X size={24} className="text-slate-500" /></button>
              </div>
              <form onSubmit={handleWalletManualSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setWalletForm({ ...walletForm, tipo: 'ENTRADA' })} className={`py-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm ${walletForm.tipo === 'ENTRADA' ? 'bg-brand-success text-white border-brand-success shadow-brand-success/20' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Entrada (+)</button>
                  <button type="button" onClick={() => setWalletForm({ ...walletForm, tipo: 'SAIDA' })} className={`py-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm ${walletForm.tipo === 'SAIDA' ? 'bg-brand-error text-white border-brand-error shadow-brand-error/20' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Saída (-)</button>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">Valor do Lançamento</label>
                  <input required placeholder="0,00" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white font-black text-3xl text-center outline-none focus:border-blue-400 transition-all shadow-inner" value={walletForm.valor} onChange={e => setWalletForm({ ...walletForm, valor: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Conta Bancária</label>
                    <select required className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={walletForm.parceiro} onChange={e => setWalletForm({ ...walletForm, parceiro: e.target.value })}>
                      <option value="">BANCO / CONTA...</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Meio de Pagamento</label>
                    <select required className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={walletForm.payment_term_id} onChange={e => setWalletForm({ ...walletForm, payment_term_id: e.target.value })}>
                      <option value="">FORMA...</option>
                      {bankManualTerms.map(t => <option key={t.id} value={t.id || t.uuid}>{t.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Classificação Categoria</label>
                  <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-400" value={walletForm.categoria} onChange={e => setWalletForm({ ...walletForm, categoria: e.target.value })}>
                    <option value="">SELECIONE A CATEGORIA...</option>
                    {filteredWalletCategories.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Descrição Operacional</label>
                  <textarea placeholder="..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs resize-none outline-none focus:border-blue-400" rows={2} value={walletForm.descricao} onChange={e => setWalletForm({ ...walletForm, descricao: e.target.value })} />
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
        details={`Tipo: ${manualEntryToAuthorize?.tipo} | Valor: ${manualEntryToAuthorize?.valor} | Desc: ${manualEntryToAuthorize?.descricao}`}
      />

      {/* MODAL AUTH REVERSE */}
      <RequestAuthorizationModal
        isOpen={isRequestReverseAuthModalOpen}
        onClose={() => setIsRequestReverseAuthModalOpen(false)}
        actionKey="ESTORNAR_TRANSACAO_CARTEIRA"
        actionLabel={`Solicitação para ESTORNAR Transação ID: ${txToAuthorize?.id || txToAuthorize?.uuid}`}
        details={`Transação: ${txToAuthorize?.descricao} | Valor: R$ ${(txToAuthorize?.valor_entrada || 0) + (txToAuthorize?.valor_saida || 0)}`}
      />
    </div >
  );
};

export default FinanceHub;

