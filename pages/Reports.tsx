
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { formatBRDate, getBRDateOnly, getTodayBR, getDaysAgoBR } from '../utils/dateHelper';
import { UserRole, CashierSession, Transaction, FinancialRecord, Partner, Material, User, PaymentTerm, PermissionModule, ActionLog } from '../types';
import AuthorizationModal from '../components/AuthorizationModal';
import {
  Activity as ActivityIcon,
  Clock,
  Box,
  Wallet,
  Users as UsersIcon,
  Package,
  Search,
  Calendar,
  Tag,
  Scale,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  Eye,
  Printer,
  History as HistoryIcon,
  BarChart3,
  Lock,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  ShoppingCart,
  Hash,
  UserCheck,
  CreditCard,
  ArrowLeftRight,
  RefreshCw,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

type ReportTab = 'receivables_mirror' | 'payables_mirror' | 'financial_statement' | 'inventory_report' | 'partners_report' | 'audit_report';

const Reports: React.FC = () => {
  const { currentUser } = useAppContext();
  const companyId = currentUser?.companyId || currentUser?.company_id || '';
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const [isLoading, setIsLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<ReportTab | null>(null);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  const [filters, setFilters] = useState<Record<string, string>>({});

  // Default date range: today only
  const [dateStart, setDateStart] = useState(getTodayBR);
  const [dateEnd, setDateEnd] = useState(getTodayBR);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const partners = useMemo(() => db.queryTenant<Partner>('partners', companyId), [companyId, refreshKey]);
  const materials = useMemo(() => db.queryTenant<Material>('materials', companyId), [companyId, refreshKey]);
  const users = useMemo(() => db.queryTenant<User>('users', companyId), [companyId, refreshKey]);
  const paymentTerms = useMemo(() => db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true), [companyId, refreshKey]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const client = db.getCloudClient();
    const targetId = isSuperAdmin ? null : companyId;

    try {
      let finData: FinancialRecord[] = [];
      let logData: ActionLog[] = [];

      if (client && targetId) {
        // Fetch Financials
        const { data: cFin } = await client.from('financials').select('*').eq('company_id', targetId);
        finData = (cFin || []).map((f: any) => db.normalize(f));

        // Fetch Logs
        console.log('[Reports] Buscando logs do Supabase para company_id:', targetId);
        const { data: cLog, error: logError } = await client.from('logs').select('*').eq('company_id', targetId);

        if (logError) {
          console.error('[Reports] ERRO ao buscar logs do Supabase:', logError);
          console.error('[Reports] Código do erro:', logError.code);
          console.error('[Reports] Mensagem:', logError.message);
        } else {
          console.log('[Reports] Logs retornados do Supabase:', cLog?.length || 0);
        }

        logData = (cLog || []).map((l: any) => db.normalize(l));
      } else {
        finData = db.queryTenant<FinancialRecord>('financials', targetId);
        logData = db.queryTenant<ActionLog>('logs', targetId);
      }

      setFinancials(finData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setLogs(logData.sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime()));

      console.log(`[Reports] Carregados ${finData.length} registros financeiros e ${logData.length} logs de auditoria`);
    } catch (err) {
      console.error("[Reports] Erro ao carregar relatórios:", err);
      console.error("[Reports] Detalhes:", { companyId, isSuperAdmin, hasClient: !!client });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, isSuperAdmin, refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh logs when audit report modal opens
  useEffect(() => {
    if (activeModal === 'audit_report') {
      loadData();
    }
  }, [activeModal]);

  const handleSyncScroll = (source: 'top' | 'header' | 'table') => {
    const top = topScrollRef.current;
    const header = headerScrollRef.current;
    const table = tableContainerRef.current;
    if (!top || !header || !table) return;
    let sl = source === 'top' ? top.scrollLeft : source === 'header' ? header.scrollLeft : table.scrollLeft;
    if (source !== 'top' && top) top.scrollLeft = sl;
    if (source !== 'header' && header) header.scrollLeft = sl;
    if (source !== 'table' && table) table.scrollLeft = sl;
  };

  const updateFilter = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
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

  const getReadableAction = (action: string) => {
    const map: Record<string, string> = {
      'AUTH_REQUEST_CREATED': 'PEDIDO DE LIBERAÇÃO',
      'AUTH_REQUEST_APPROVED': 'LIBERAÇÃO CONCEDIDA',
      'AUTH_REQUEST_DENIED': 'LIBERAÇÃO NEGADA',
      'STOCK_ADD': 'CADASTRO MATERIAL',
      'STOCK_EDIT_EXECUTED': 'EDITOU MATERIAL',
      'STOCK_DELETE_EXECUTED': 'EXCLUIR MATERIAL',
      'STOCK_ADJUST_EXECUTED': 'AJUSTE DE SALDO',
      'PARTNER_ADD': 'CADASTRO PARCEIRO',
      'PARTNER_EDIT_EXECUTED': 'EDITOU PARCEIRO',
      'PARTNER_DELETE_EXECUTED': 'EXCLUIR PARCEIRO',
      'BACKUP_EXPORT': 'EXPORTAÇÃO DADOS',
      'BACKUP_RESTORE': 'RESTAURAÇÃO DADOS',
      'SAAS_COMPANY_UPDATE': 'ALTERAÇÃO EMPRESA',
      'USER_EDIT_EXECUTED': 'ALTERAÇÃO ACESSO',
      'BANK_ADD': 'CADASTRO BANCO',
      'BANK_EDIT_EXECUTED': 'AJUSTE DE CONTA',
      'AUDIT_MASTER_RECONCILIATION': 'AUDITORIA DE LOGS'
    };
    return map[action] || action.replace(/_/g, ' ').toUpperCase();
  };

  const getReadableDetails = (log: ActionLog) => {
    const details = log.details;
    if (!details) return 'DETALHES NÃO REGISTRADOS PELA AUDITORIA';
    const reqMatch = details.match(/\(PEDIDO (REQ-[A-Z0-9]+)\)/);
    const requestId = reqMatch ? reqMatch[1] : 'AVULSO';
    let cleanString = details;
    if (details.includes('SOLICITAÇÃO DE LIBERAÇÃO PARA AÇÃO: ')) {
      cleanString = details.split('SOLICITAÇÃO DE LIBERAÇÃO PARA AÇÃO: ')[1];
    } else if (details.includes('CONCEDIDA PARA O (PEDIDO')) {
      const parts = details.split(') ');
      if (parts.length > 1) cleanString = parts.slice(1).join(') ');
    }
    const keyParts = cleanString.split(' | ');
    const data: Record<string, string> = {};
    keyParts.forEach(kp => {
      const [key, ...val] = kp.split(': ');
      if (key && val.length > 0) data[key.trim().toUpperCase()] = val.join(': ').trim();
    });
    if (data['OP']) {
      const op = data['OP'];
      const ctx = data['CTX'] || 'TERMINAL PDV';
      const rawDet = data['DET'] || 'OPERAÇÃO REALIZADA NO SISTEMA';
      const val = data['VAL'] || data['VALOR'] || 'R$ 0,00 PARA R$ 0,00';
      const user = log.user_name || 'SISTEMA';
      const det = rawDet.charAt(0).toUpperCase() + rawDet.slice(1).toLowerCase();
      return `(PEDIDO ${requestId}) –
Usuário: ${user}
Operação: ${op}
Contexto: ${ctx}
Detalhes: ${det}
Valor envolvido: ${val}`;
    }
    return details.replace(/DATA: \{.*?\}/gi, 'DADOS ATUALIZADOS').replace(/[a-f0-9-]{30,}/gi, (match) => `REF: ${match.slice(0, 8)}`).replace(/\|/g, '•').toUpperCase();
  };

  const filteredFinancials = useMemo(() => {
    return financials.filter(f => {
      const fDate = (f.created_at || '').substring(0, 10);
      const matchDate = fDate >= dateStart && fDate <= dateEnd;
      const partner = partners.find(p => p.id === f.parceiro_id);
      const matchNatureza = !filters.natureza || (f.natureza || '').toUpperCase().includes(filters.natureza.toUpperCase());
      const matchPartner = !filters.partner || (partner?.name || '').toLowerCase().includes(filters.partner.toLowerCase());
      const matchStatus = !filters.status || getStatusInfo(f).label.toLowerCase().includes(filters.status.toLowerCase());
      const matchDesc = !filters.description || (f.description || '').toLowerCase().includes(filters.description.toLowerCase());
      if (activeModal === 'receivables_mirror') { if (f.categoria !== 'Venda de Materiais') return false; }
      if (activeModal === 'payables_mirror') { if (f.categoria !== 'Compra de Materiais') return false; }
      return matchDate && matchNatureza && matchPartner && matchStatus && matchDesc;
    });
  }, [financials, filters, dateStart, dateEnd, partners, activeModal]);

  const filteredLogs = useMemo(() => {
    console.log('[Reports] Filtrando logs. Total carregado:', logs.length);
    console.log('[Reports] Filtro de data:', { dateStart, dateEnd });
    console.log('[Reports] Primeiros 3 logs (sample):', logs.slice(0, 3).map(l => ({
      created_at: l.created_at,
      timestamp: l.timestamp,
      action: l.action,
      user_name: l.user_name
    })));

    // Find logs from today specifically (using BR timezone)
    const today = getTodayBR();
    const logsFromToday = logs.filter(l => {
      const lDate = getBRDateOnly(l.created_at || l.timestamp || '');
      return lDate === today;
    });
    console.log(`[Reports] Logs de HOJE (${today}):`, logsFromToday.length);
    if (logsFromToday.length > 0) {
      console.log('[Reports] Exemplos de logs de hoje:', logsFromToday.slice(0, 3).map(l => ({
        created_at: l.created_at,
        extractedDate: getBRDateOnly(l.created_at || l.timestamp || ''),
        action: l.action
      })));
    }

    const filtered = logs.filter(l => {
      const lDate = getBRDateOnly(l.created_at || l.timestamp || '');
      const matchDate = lDate >= dateStart && lDate <= dateEnd;
      const matchUser = !filters.log_user || (l.user_name || '').toLowerCase().includes(filters.log_user.toLowerCase());
      const matchAction = !filters.log_action || (l.action || '').toLowerCase().includes(filters.log_action.toLowerCase());
      const matchDetail = !filters.log_detail || (l.details || '').toLowerCase().includes(filters.log_detail.toLowerCase());

      // Log specifically for today's logs that don't match
      if (lDate === today && !matchDate) {
        console.log('[Reports] ⚠️ Log de HOJE filtrado:', { lDate, dateStart, dateEnd, matchDate, log: l });
      }

      return matchDate && matchUser && matchAction && matchDetail;
    });

    console.log('[Reports] Logs após filtro:', filtered.length);
    console.log('[Reports] Logs de hoje após filtro:', filtered.filter(l => getBRDateOnly(l.created_at || l.timestamp || '') === today).length);
    return filtered;
  }, [logs, filters, dateStart, dateEnd]);

  const filteredMaterialsReport = useMemo(() => {
    return materials.filter(m => !filters.material_name || m.name.toLowerCase().includes(filters.material_name.toLowerCase()));
  }, [materials, filters.material_name]);

  const filteredPartnersReport = useMemo(() => {
    return partners.filter(p => {
      const matchName = !filters.partner_name_rep || p.name.toLowerCase().includes(filters.partner_name_rep.toLowerCase());
      const matchDoc = !filters.partner_doc_rep || p.document.includes(filters.partner_doc_rep);
      const matchType = !filters.partner_type_rep || p.type.toLowerCase().includes(filters.partner_type_rep.toLowerCase());
      return matchName && matchDoc && matchType;
    });
  }, [partners, filters.partner_name_rep, filters.partner_doc_rep, filters.partner_type_rep]);

  const inventoryStats = useMemo(() => {
    return filteredMaterialsReport.reduce((acc, m) => ({
      totalCost: acc.totalCost + (m.stock * (m.buyPrice || 0)),
      totalSale: acc.totalSale + (m.stock * (m.sellPrice || 0)),
      totalKg: acc.totalKg + (m.unit === 'KG' ? m.stock : 0)
    }), { totalCost: 0, totalSale: 0, totalKg: 0 });
  }, [filteredMaterialsReport]);

  const reportItems = [
    { id: 'financial_statement', label: 'Extrato Geral', description: 'Consolidado de movimentações', icon: ArrowLeftRight, color: 'green', permission: PermissionModule.REPORTS_GENERAL },
    { id: 'receivables_mirror', label: 'Contas a Receber', description: 'Vendas e títulos de entrada', icon: ArrowUpCircle, color: 'blue', permission: PermissionModule.REPORTS_RECEIVABLES },
    { id: 'payables_mirror', label: 'Contas a Pagar', description: 'Compras e títulos de saída', icon: ArrowDownCircle, color: 'red', permission: PermissionModule.REPORTS_PAYABLES },
    { id: 'inventory_report', label: 'Saldo de Estoque', description: 'Saldos e projeção de pátio', icon: Package, color: 'yellow', permission: PermissionModule.REPORTS_STOCK },
    { id: 'partners_report', label: 'Mov. do Parceiros', description: 'Filtro avançado de parceiros', icon: UsersIcon, color: 'indigo', permission: PermissionModule.REPORTS_PARTNERS },
    { id: 'audit_report', label: 'Auditoria de Logs', description: 'Histórico narrativo de segurança', icon: HistoryIcon, color: 'yellow', permission: PermissionModule.REPORTS_AUDIT }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'border-t-brand-success shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)] hover:bg-gradient-to-b from-brand-success/10 to-transparent';
      case 'blue': return 'border-t-blue-500 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)] hover:bg-gradient-to-b from-blue-500/10 to-transparent';
      case 'yellow': return 'border-t-brand-warning shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)] hover:bg-gradient-to-b from-brand-warning/10 to-transparent';
      case 'red': return 'border-t-brand-error shadow-[0_0_15px_-5px_rgba(244,63,81,0.2)] hover:bg-gradient-to-b from-brand-error/10 to-transparent';
      case 'indigo': return 'border-t-indigo-500 shadow-[0_0_15px_-5px_rgba(99,102,241,0.2)] hover:bg-gradient-to-b from-indigo-500/10 to-transparent';
      default: return 'border-t-slate-800';
    }
  };

  const getIconColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'text-brand-success group-hover:bg-brand-success/10';
      case 'blue': return 'text-blue-400 group-hover:bg-blue-500/10';
      case 'yellow': return 'text-brand-warning group-hover:bg-brand-warning/10';
      case 'red': return 'text-brand-error group-hover:bg-brand-error/10';
      case 'indigo': return 'text-indigo-400 group-hover:bg-indigo-500/10';
      default: return 'text-slate-400';
    }
  };

  const ColumnFilter = ({ col, placeholder }: { col: string, placeholder?: string }) => (
    <div className="mt-2 relative no-print">
      <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 pl-7 text-[9px] font-bold text-white outline-none focus:border-brand-success transition-all" placeholder={placeholder || "Filtrar..."} value={filters[col] || ''} onChange={e => updateFilter(col, e.target.value)} />
      <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
    </div>
  );

  const formatDate = (iso: string | undefined) => {
    if (!iso) return '---';
    try { const cleanDate = iso.substring(0, 10); const [year, month, day] = cleanDate.split('-'); return `${day}/${month}/${year}`; } catch { return '---'; }
  };

  const formatTime = (iso: string | undefined) => {
    if (!iso) return '';
    try { const d = new Date(iso); if (isNaN(d.getTime())) return ''; return d.toLocaleTimeString('pt-BR'); } catch { return ''; }
  };

  const openTransactionDetails = (transactionId?: string, partnerId?: string) => {
    if (!transactionId) return;
    const trans = db.queryTenant<Transaction>('transactions', companyId).find(t => t.id === transactionId);
    if (trans) setViewingTransaction({ ...trans, parceiro_id: partnerId } as any);
    else alert("Detalhes não localizados.");
  };

  return (
    <div className="space-y-8 pb-20 md:pb-8">
      <header className="px-2 no-print flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-white uppercase tracking-tight">
            <ActivityIcon className="text-brand-success" /> Relatórios de Auditoria
          </h1>
          <p className="text-slate-500 text-sm mt-1">Dados brutos extraídos diretamente do core financeiro cloud.</p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <div className="flex items-center gap-2 text-brand-success"><Loader2 className="animate-spin" size={16} /><span className="text-[10px] font-black uppercase">Sincronizando...</span></div>}
          <button onClick={triggerRefresh} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2 no-print ${activeModal ? 'hidden lg:grid' : ''}`}>
        {reportItems.filter(item => isSuperAdmin || currentUser?.permissions.includes(item.permission)).map(item => (
          <button key={item.id} onClick={() => { setActiveModal(item.id as any); setFilters({}); }} className={`enterprise-card p-8 flex items-center gap-6 transition-all group text-left bg-slate-900/40 border-t-4 ${getColorClasses(item.color)} hover:scale-[1.01]`}>
            <div className={`w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center transition-all border border-slate-700 ${getIconColorClasses(item.color)}`}><item.icon size={32} /></div>
            <div className="flex-1 min-w-0"><h3 className="text-white font-black uppercase text-base tracking-widest group-hover:translate-x-1 transition-transform">{item.label}</h3><p className="text-slate-500 text-xs mt-1 truncate font-medium">{item.description}</p></div>
            <ChevronRight className="text-slate-700 group-hover:text-white transition-all group-hover:translate-x-1" size={24} />
          </button>
        ))}
      </div>



      {activeModal && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in duration-200">
          <header className="bg-brand-card border-b border-slate-800 p-4 flex items-center justify-between shrink-0 no-print">
            <div className="flex items-center gap-3 ml-4">
              {(() => {
                const report = reportItems.find(t => t.id === activeModal);
                const colorHex = report?.color === 'green' ? 'brand-success' : report?.color === 'blue' ? 'blue-500' : report?.color === 'yellow' ? 'brand-warning' : report?.color === 'red' ? 'brand-error' : 'indigo-500';
                return (<div className={`w-10 h-10 rounded-xl bg-${colorHex}/10 flex items-center justify-center text-${colorHex} border border-${colorHex}/20`}>{React.createElement(report?.icon || Box, { size: 20 })}</div>);
              })()}
              <h2 className="text-lg font-black text-white uppercase tracking-tighter">{reportItems.find(t => t.id === activeModal)?.label}</h2>
            </div>
            <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all flex items-center gap-2 px-4 mr-4"><span className="text-[10px] font-black uppercase tracking-widest">Fechar Janela</span><X size={20} /></button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-brand-dark">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row bg-slate-950/80 p-4 rounded-2xl border border-slate-800 items-center gap-6 w-full md:w-fit no-print">
                <div className="flex items-center gap-4"><Calendar size={18} className="text-brand-success" />
                  <div className="flex items-center gap-3">
                    <input type="date" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-black uppercase text-white outline-none focus:border-brand-success [color-scheme:dark]" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                    <span className="text-slate-600 font-bold text-[10px]">ATÉ</span>
                    <input type="date" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-black uppercase text-white outline-none focus:border-brand-success [color-scheme:dark]" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800 hidden md:block"></div>

                {/* FILTROS: EXTRATO / A RECEBER / A PAGAR */}
                {(activeModal === 'financial_statement' || activeModal === 'receivables_mirror' || activeModal === 'payables_mirror') && (
                  <>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Natureza</span>
                      <select
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-24"
                        value={filters.natureza || ''}
                        onChange={e => updateFilter('natureza', e.target.value)}
                      >
                        <option value="">TODAS</option>
                        <option value="ENTRADA">ENTRADA</option>
                        <option value="SAIDA">SAÍDA</option>
                      </select>
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Parceiro</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-32"
                        placeholder="Nome..."
                        value={filters.partner || ''}
                        onChange={e => updateFilter('partner', e.target.value)}
                      />
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Desc.</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-32"
                        placeholder="Identificação..."
                        value={filters.description || ''}
                        onChange={e => updateFilter('description', e.target.value)}
                      />
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Status</span>
                      <select
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-24"
                        value={filters.status || ''}
                        onChange={e => updateFilter('status', e.target.value)}
                      >
                        <option value="">TODOS</option>
                        <option value="ABERTO">ABERTO</option>
                        <option value="LIQUIDADO">LIQUIDADO</option>
                        <option value="ATRASADO">ATRASADO</option>
                        <option value="CANCELADO">CANCELADO</option>
                      </select>
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                  </>
                )}

                {/* FILTROS: ESTOQUE */}
                {activeModal === 'inventory_report' && (
                  <>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Material</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-48"
                        placeholder="Buscar material..."
                        value={filters.material_name || ''}
                        onChange={e => updateFilter('material_name', e.target.value)}
                      />
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                  </>
                )}

                {/* FILTROS: PARCEIROS */}
                {activeModal === 'partners_report' && (
                  <>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Nome</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-32"
                        placeholder="Buscar parceiro..."
                        value={filters.partner_name_rep || ''}
                        onChange={e => updateFilter('partner_name_rep', e.target.value)}
                      />
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Doc</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-24"
                        placeholder="CPF/CNPJ..."
                        value={filters.partner_doc_rep || ''}
                        onChange={e => updateFilter('partner_doc_rep', e.target.value)}
                      />
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Tipo</span>
                      <select
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-24"
                        value={filters.partner_type_rep || ''}
                        onChange={e => updateFilter('partner_type_rep', e.target.value)}
                      >
                        <option value="">TODOS</option>
                        <option value="supplier">FORNECEDOR</option>
                        <option value="customer">CLIENTE</option>
                      </select>
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                  </>
                )}

                {activeModal === 'audit_report' && (
                  <>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Usuário</span>
                      <select
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-32"
                        value={filters.log_user || ''}
                        onChange={e => updateFilter('log_user', e.target.value)}
                      >
                        <option value="">TODOS</option>
                        {users.map(u => <option key={u.id} value={u.name}>{u.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Ação</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-32"
                        placeholder="Buscar ação..."
                        value={filters.log_action || ''}
                        onChange={e => updateFilter('log_action', e.target.value)}
                      />
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Detalhes</span>
                      <input
                        type="text"
                        className="bg-slate-950 p-1 text-[9px] font-black text-white rounded outline-none w-48"
                        placeholder="Buscar narrativa..."
                        value={filters.log_detail || ''}
                        onChange={e => updateFilter('log_detail', e.target.value)}
                      />
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                  </>
                )}

                <button onClick={triggerRefresh} className="w-full md:w-auto px-6 py-2.5 bg-brand-success/10 text-brand-success border border-brand-success/30 rounded-xl font-black uppercase text-[10px] hover:bg-brand-success hover:text-white transition-all shadow-lg flex items-center gap-2">{isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar Filtros</button>
              </div>

              {activeModal === 'inventory_report' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                  <div className="enterprise-card p-6 border-l-4 border-l-blue-500 bg-blue-500/5 shadow-lg"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Custo Total de Estoque</p><h3 className="text-2xl font-black text-white">R$ {inventoryStats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3><div className="flex items-center gap-1.5 mt-2 text-blue-400"><TrendingDown size={14} /><span className="text-[9px] font-bold uppercase">Patrimônio Materiais</span></div></div>
                  <div className="enterprise-card p-6 border-l-4 border-l-brand-success bg-brand-success/5 shadow-lg"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Valor Projetado de Venda</p><h3 className="text-2xl font-black text-white">R$ {inventoryStats.totalSale.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3><div className="flex items-center gap-1.5 mt-2 text-brand-success"><TrendingUp size={14} /><span className="text-[9px] font-bold uppercase">Potencial Líquido</span></div></div>
                  <div className="enterprise-card p-6 border-l-4 border-l-brand-warning bg-brand-warning/5 shadow-lg"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo em Massa (KG)</p><h3 className="text-2xl font-black text-white">{inventoryStats.totalKg.toLocaleString()} <span className="text-xs opacity-50">KG</span></h3><div className="flex items-center gap-1.5 mt-2 text-brand-warning"><Scale size={14} /><span className="text-[9px] font-bold uppercase">Volume Armazenado</span></div></div>
                </div>
              )}

              <div className="enterprise-card border-slate-800 overflow-hidden shadow-xl bg-slate-900/10">
                {(activeModal === 'financial_statement' || activeModal === 'receivables_mirror' || activeModal === 'payables_mirror') && (
                  <div className="overflow-hidden">
                    <div ref={headerScrollRef} onScroll={() => handleSyncScroll('header')} className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-900/60 border-b border-slate-800 no-print">
                      <table className="w-full text-left min-w-[2150px] table-fixed">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-5 w-[100px]">REF #</th>
                            <th className="px-4 py-5 w-[140px]">Data Criação</th>
                            <th className="px-4 py-5 w-[140px]">Vencimento</th>
                            <th className="px-4 py-5 w-[140px]">Data Baixa</th>
                            <th className="px-4 py-5 w-[120px]">Natureza</th>
                            <th className="px-4 py-5 w-[250px]">Parceiro</th>
                            <th className="px-4 py-5 w-[180px]">Categoria</th>
                            <th className="px-4 py-5 w-[300px]">Identificação</th>
                            <th className="px-4 py-5 w-[180px]">Meio/Prazo</th>
                            <th className="px-4 py-5 text-right w-[150px]">Valor Bruto</th>
                            <th className="px-4 py-5 w-[180px]">Membro</th>
                            <th className="px-4 py-5 text-center w-[120px]">Status</th>
                            <th className="px-4 py-5 text-center w-[100px]">Transação</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div ref={topScrollRef} onScroll={() => handleSyncScroll('top')} className="overflow-x-auto h-2 md:h-3 no-print bg-slate-900/60 border-b border-slate-800"><div style={{ width: '2150px', height: '1px' }}></div></div>
                    <div ref={tableContainerRef} onScroll={() => handleSyncScroll('table')} className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[2150px] table-fixed">
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredFinancials.length === 0 ? (<tr><td colSpan={13} className="py-20 text-center text-slate-600 font-bold uppercase tracking-widest">Nenhum registro para o período</td></tr>) : filteredFinancials.map(f => {
                            const partner = partners.find(p => p.id === f.parceiro_id);
                            const term = paymentTerms.find(t => t.id === f.paymentTermId || t.uuid === f.paymentTermId || t.id === f.payment_term_id || t.uuid === f.payment_term_id);
                            const responsible = users.find(u => u.id === f.usuario_id || u.id === f.user_id || u.id === f.userId);
                            const statusInfo = getStatusInfo(f);
                            return (
                              <tr key={f.id} className={`text-xs text-slate-300 hover:bg-slate-800/20 group transition-colors ${statusInfo.isStriked ? 'opacity-50 line-through grayscale' : ''}`}>
                                <td className="px-4 py-4 font-mono text-[9px] text-slate-500 w-[100px]">#{f.id.slice(0, 6).toUpperCase()}</td>
                                <td className="px-4 py-4 w-[140px]"><div className="flex flex-col"><span className="font-medium text-slate-400">{formatDate(f.created_at || '')}</span><span className="text-[10px] opacity-50 font-mono">{formatTime(f.created_at || '')}</span></div></td>
                                <td className="px-4 py-4 font-bold text-slate-400 w-[140px]">{formatDate(f.dueDate || f.due_date)}</td>
                                <td className="px-4 py-4 w-[140px]">{f.liquidation_date ? (<div className="flex flex-col"><span className="font-black text-white">{formatDate(f.liquidation_date)}</span><span className="text-[10px] opacity-50 font-mono text-white">{formatTime(f.liquidation_date)}</span></div>) : <span className="text-slate-700 italic text-[10px] font-black">---</span>}</td>
                                <td className="px-4 py-4 w-[120px]"><div className="flex items-center gap-2">{f.natureza === 'ENTRADA' ? <ArrowUpCircle size={14} className="text-brand-success" /> : <ArrowDownCircle size={14} className="text-brand-error" />}<span className={`font-black text-[9px] ${f.natureza === 'ENTRADA' ? 'text-brand-success' : 'text-brand-error'}`}>{f.natureza}</span></div></td>
                                <td className="px-4 py-4 truncate font-bold uppercase text-[10px] text-slate-200 w-[250px]">{partner?.name || 'CONSUMIDOR FINAL'}</td>
                                <td className="px-4 py-4 uppercase font-bold text-blue-400 truncate w-[180px] text-[10px]">{f.categoria}</td>
                                <td className="px-4 py-4 truncate text-[10px] text-slate-400 w-[300px] uppercase font-medium">{f.description || 'S/D'}</td>
                                <td className="px-4 py-4 w-[180px]"><span className="text-[9px] font-black uppercase text-slate-400">{statusInfo.label === 'PENDENTE' ? 'PENDENTE' : (term?.name || (f.liquidation_date ? 'À VISTA' : 'PENDENTE'))}</span></td>
                                <td className={`px-4 py-4 text-right font-black w-[150px] text-sm ${f.natureza === 'ENTRADA' ? 'text-brand-success' : 'text-brand-error'}`}>R$ {f.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-4 truncate w-[180px] text-[10px] font-medium text-slate-400">{responsible?.name || 'Sistema'}</td>
                                <td className="px-4 py-4 text-center w-[120px]"><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border shadow-sm ${statusInfo.color}`}>{statusInfo.label}</span></td>
                                <td className="px-4 py-4 text-center w-[100px]">{f.transaction_id && <button onClick={() => openTransactionDetails(f.transaction_id, f.parceiro_id)} className="p-1.5 bg-slate-800 hover:bg-blue-500/20 rounded transition-all text-blue-400 hover:text-white"><Eye size={14} /></button>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeModal === 'audit_report' && (
                  <div className="overflow-hidden">
                    <div ref={headerScrollRef} onScroll={() => handleSyncScroll('header')} className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-900/60 border-b border-slate-800 no-print">
                      <table className="w-full text-left min-w-[1500px] table-fixed">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-5 w-[180px]">Data / Horário</th>
                            <th className="px-4 py-5 w-[220px]">Usuário Responsável</th>
                            <th className="px-4 py-5 w-[200px]">Ação Realizada</th>
                            <th className="px-4 py-5 w-[900px]">Informações Narrativas de Auditoria</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div ref={topScrollRef} onScroll={() => handleSyncScroll('top')} className="overflow-x-auto h-2 md:h-3 no-print bg-slate-900/60 border-b border-slate-800"><div style={{ width: '1500px', height: '1px' }}></div></div>
                    <div ref={tableContainerRef} onScroll={() => handleSyncScroll('table')} className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[1500px] table-fixed">
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredLogs.length === 0 ? (<tr><td colSpan={4} className="py-20 text-center text-slate-600 font-bold uppercase tracking-widest">Nenhum log localizado</td></tr>) : filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-800/20 transition-colors text-[10px] font-medium">
                              <td className="px-4 py-4 font-mono text-slate-500 w-[180px]">{new Date(log.created_at || log.timestamp || 0).toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-4 font-black text-slate-200 uppercase truncate w-[220px]">{log.user_name || 'SISTEMA'}</td>
                              <td className="px-4 py-4 w-[200px]"><span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[8px] font-black uppercase text-brand-success shadow-sm">{getReadableAction(log.action)}</span></td>
                              <td className="px-4 py-4 text-slate-400 leading-relaxed whitespace-pre-wrap font-sans w-[900px]">{getReadableDetails(log)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeModal === 'inventory_report' && (
                  <div className="overflow-hidden">
                    <div ref={headerScrollRef} onScroll={() => handleSyncScroll('header')} className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-900/60 border-b border-slate-800 no-print">
                      <table className="w-full text-left min-w-[1300px] table-fixed">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-5 w-[100px]"># ID</th>
                            <th className="px-4 py-5 w-[300px]">Material</th>
                            <th className="px-4 py-5 text-center w-[100px]">Unidade</th>
                            <th className="px-4 py-5 text-right w-[150px]">Pr. Compra</th>
                            <th className="px-4 py-5 text-right w-[150px]">Pr. Venda</th>
                            <th className="px-4 py-5 text-center w-[120px]">Saldo Real</th>
                            <th className="px-4 py-5 text-right w-[180px]">Vlr. Custo Total</th>
                            <th className="px-4 py-5 text-right w-[180px]">Vlr. Venda Total</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div ref={topScrollRef} onScroll={() => handleSyncScroll('top')} className="overflow-x-auto h-2 md:h-3 no-print bg-slate-900/60 border-b border-slate-800"><div style={{ width: '1300px', height: '1px' }}></div></div>
                    <div ref={tableContainerRef} onScroll={() => handleSyncScroll('table')} className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[1300px] table-fixed">
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredMaterialsReport.map(m => (
                            <tr key={m.id} className="text-xs text-slate-300 hover:bg-slate-800/20 group transition-colors">
                              <td className="px-4 py-4 font-mono text-[9px] text-slate-500 w-[100px]">#{m.id.slice(0, 6).toUpperCase()}</td>
                              <td className="px-4 py-4 font-bold text-slate-100 uppercase truncate w-[300px]">{m.name}</td>
                              <td className="px-4 py-4 text-center font-black text-slate-500 w-[100px] uppercase">{m.unit}</td>
                              <td className="px-4 py-4 text-right font-mono text-slate-400 w-[150px]">R$ {m.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-4 text-right font-mono text-slate-400 w-[150px]">R$ {m.sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className={`px-4 py-4 text-center font-black w-[120px] ${m.stock <= (m.minStock || 0) ? 'text-brand-error' : 'text-brand-success'}`}>{m.stock.toLocaleString()}</td>
                              <td className="px-4 py-4 text-right font-black text-slate-200 w-[180px]">R$ {(m.stock * m.buyPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-4 text-right font-black text-brand-success w-[180px]">R$ {(m.stock * m.sellPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeModal === 'partners_report' && (
                  <div className="overflow-hidden">
                    <div ref={headerScrollRef} onScroll={() => handleSyncScroll('header')} className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-900/60 border-b border-slate-800 no-print">
                      <table className="w-full text-left min-w-[1200px] table-fixed">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-5 w-[120px]"># ID</th>
                            <th className="px-4 py-5 w-[350px]">Parceiro</th>
                            <th className="px-4 py-5 w-[200px]">CPF / CNPJ</th>
                            <th className="px-4 py-5 w-[180px]">Telefone</th>
                            <th className="px-4 py-5 w-[150px] text-center">Tipo</th>
                            <th className="px-4 py-5 w-[200px]">Data Cadastro</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div ref={topScrollRef} onScroll={() => handleSyncScroll('top')} className="overflow-x-auto h-2 md:h-3 no-print bg-slate-900/60 border-b border-slate-800"><div style={{ width: '1200px', height: '1px' }}></div></div>
                    <div ref={tableContainerRef} onScroll={() => handleSyncScroll('table')} className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[1200px] table-fixed">
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredPartnersReport.map(p => (
                            <tr key={p.id} className="text-xs text-slate-300 hover:bg-slate-800/20 group transition-colors">
                              <td className="px-4 py-4 font-mono text-[9px] text-slate-500 w-[120px]">#{p.id.slice(0, 8).toUpperCase()}</td>
                              <td className="px-4 py-4 font-bold text-slate-100 uppercase truncate w-[350px]">{p.name}</td>
                              <td className="px-4 py-4 font-mono text-slate-400 w-[200px]">{p.document}</td>
                              <td className="px-4 py-4 text-slate-400 w-[180px]">{p.phone}</td>
                              <td className="px-4 py-4 text-center w-[150px]"><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${p.type === 'supplier' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' : p.type === 'customer' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-brand-success/10 text-brand-success border-brand-success/20'}`}>{p.type === 'supplier' ? 'FORNECEDOR' : p.type === 'customer' ? 'CLIENTE' : 'AMBOS'}</span></td>
                              <td className="px-4 py-4 text-slate-500 w-[200px]">{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '---'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}
      {viewingTransaction && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/98 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-2xl overflow-hidden shadow-2xl border-slate-700 bg-brand-dark animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3"><Receipt className="text-brand-success" size={24} /><h2 className="text-lg font-black text-white uppercase tracking-widest">Detalhes do Movimento</h2></div>
              <button onClick={() => setViewingTransaction(null)} className="text-slate-500 hover:text-white p-2 bg-slate-800 rounded-xl"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Referência</p><p className="text-white font-mono font-bold text-sm uppercase">#{viewingTransaction.id.slice(0, 8).toUpperCase()}</p></div>
                <div className="text-right"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data/Hora</p><p className="text-white font-bold text-sm">{new Date(viewingTransaction.created_at).toLocaleString('pt-BR')}</p></div>
                <div className="col-span-2 border-t border-slate-800 pt-4 mt-2"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Parceiro Envolvido</p><p className="text-white font-bold uppercase">{partners.find(p => p.id === (viewingTransaction as any).parceiro_id)?.name || 'CONSUMIDOR FINAL'}</p></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Relação de Itens</h3>
                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                  {viewingTransaction.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-xl group hover:border-brand-success transition-colors">
                      <div><p className="font-black text-white uppercase text-xs tracking-tight">{item.materialName || item.material_name}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{item.quantity} {item.unit} x R$ {item.price.toLocaleString()}</p></div>
                      <div className="text-right"><p className="font-black text-brand-success">R$ {item.total.toLocaleString()}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-800 flex justify-between items-center">
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total da Operação</p><p className="text-3xl font-black text-white">R$ {viewingTransaction.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all"><Printer size={16} /> Re-imprimir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
