import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../services/dbService';
import { useAppContext } from '../store/AppContext';
import { Company, Plan, PermissionModule, UserRole } from '../types';
import {
  Building2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity as ActivityIcon,
  Plus,
  CreditCard,
  Edit2,
  Trash2,
  X,
  Lock,
  Calendar,
  Zap,
  CheckCircle2,
  Shield,
  Key,
  Users as UsersIcon,
  Search,
  Filter,
  MoreVertical,
  ArrowUpRight,
  Save,
  Clock,
  Settings,
  Check,
  Power,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SaasAdminProps {
  view: 'dashboard' | 'companies' | 'plans';
}

const SaasAdmin: React.FC<SaasAdminProps> = ({ view }) => {
  const { currentUser } = useAppContext();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Refs para sincronização de scroll horizontal (Padrão Master-Sync)
  const topScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Modais
  const [companyModal, setCompanyModal] = useState<{ show: boolean, data: Company | null }>({ show: false, data: null });
  const [planModal, setPlanModal] = useState<{ show: boolean, mode: 'create' | 'edit', data: Partial<Plan> | null }>({ show: false, mode: 'create', data: null });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const client = db.getCloudClient();

    try {
      // @google/genai Senior Frontend Engineer: Busca real-time do Supabase
      if (client) {
        const [companiesRes, plansRes] = await Promise.all([
          client.from('companies').select('*').order('created_at', { ascending: false }),
          client.from('plans').select('*').order('price', { ascending: true })
        ]);

        if (companiesRes.data) {
          const normalized = companiesRes.data.map(db.normalize);
          setCompanies(normalized);
          // Sincroniza cache local silenciosamente
          const state = db.get();
          state.companies = normalized;
          db.save(state);
        }

        if (plansRes.data) {
          const normalized = plansRes.data.map(db.normalize);
          setPlans(normalized);
          const state = db.get();
          state.plans = normalized;
          db.save(state);
        }
      } else {
        // Fallback Local
        setCompanies(db.query<Company>('companies'));
        setPlans(db.query<Plan>('plans'));
      }
    } catch (err) {
      console.error("Erro ao carregar dados SaaS:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, view]);

  if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <ShieldAlert size={64} className="text-brand-error" />
        <h2 className="text-2xl font-bold uppercase tracking-tighter text-white">Acesso Restrito ao Master</h2>
        <p className="text-slate-500">Apenas administradores globais podem acessar esta área.</p>
      </div>
    );
  }

  const handleSyncScroll = (source: 'top' | 'header' | 'table') => {
    const top = topScrollRef.current;
    const header = headerScrollRef.current;
    const table = tableContainerRef.current;
    if (!top || !header || !table) return;
    let sl = 0;
    if (source === 'top') sl = top.scrollLeft;
    else if (source === 'header') sl = header.scrollLeft;
    else sl = table.scrollLeft;
    if (source !== 'top') top.scrollLeft = sl;
    if (source !== 'header') header.scrollLeft = sl;
    if (source !== 'table') table.scrollLeft = sl;
  };

  const stats = useMemo(() => {
    const active = companies.filter(c => c.status === 'active').length;
    const trial = companies.filter(c => c.status === 'trial').length;
    const blocked = companies.filter(c => c.status === 'blocked').length;

    const mrr = companies.reduce((sum, company) => {
      const pId = company.planId || company.plan_id;
      const plan = plans.find(p => p.id === pId);
      return company.status === 'active' ? sum + (plan?.price || 0) : sum;
    }, 0);

    return { active, trial, blocked, mrr, total: companies.length };
  }, [companies, plans]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search)
    );
  }, [companies, search]);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyModal.data) return;
    setIsLoading(true);
    try {
      await db.update('companies', companyModal.data.id, companyModal.data);
      db.logAction(null, currentUser.id, currentUser.name, 'SAAS_COMPANY_UPDATE', `MASTER: Atualizou vigência/status da empresa "${companyModal.data.name}"`);
      await loadData();
      setCompanyModal({ show: false, data: null });
    } catch (err) {
      alert("Erro ao atualizar empresa.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm("Deseja realmente REMOVER esta empresa? Esta ação é irreversível e apagará todos os dados vinculados.")) {
      setIsLoading(true);
      try {
        const company = companies.find(c => c.id === id);
        await db.delete('companies', id);
        db.logAction(null, currentUser.id, currentUser.name, 'SAAS_COMPANY_DELETE', `MASTER: Excluiu permanentemente a empresa "${company?.name}"`);
        await loadData();
      } catch (err) {
        alert("Erro ao remover empresa.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (planModal.mode === 'create') {
        await db.insert('plans', {
          ...planModal.data,
          is_active: planModal.data?.is_active ?? true,
          billing_cycle: planModal.data?.billing_cycle ?? 'monthly'
        });
        db.logAction(null, currentUser.id, currentUser.name, 'SAAS_PLAN_CREATE', `MASTER: Criou novo modelo de plano comercial "${planModal.data?.name}"`);
      } else {
        await db.update('plans', planModal.data!.id!, planModal.data);
        db.logAction(null, currentUser.id, currentUser.name, 'SAAS_PLAN_UPDATE', `MASTER: Editou configurações do plano "${planModal.data?.name}"`);
      }
      setPlanModal({ show: false, mode: 'create', data: null });
      await loadData();
    } catch (err) {
      alert("Erro ao gravar plano no Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (confirm(`ADMIN: Remover plano ID ${id}?`)) {
      console.log(`[DELETE_PLAN] Iniciando exclusão do plano ${id}`);
      setIsLoading(true);
      try {
        await db.delete('plans', id);
        db.logAction(null, currentUser.id, currentUser.name, 'SAAS_PLAN_DELETE', `MASTER: Removeu o plano comercial ID ${id}`);
        await loadData();
      } catch (err: any) {
        alert(`Erro ao remover plano: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const operationalModules = [
    { id: PermissionModule.DASHBOARD, label: 'Dashboard' },
    { id: PermissionModule.PURCHASES, label: 'Compras' },
    { id: PermissionModule.SALES, label: 'Vendas' },
    { id: PermissionModule.FINANCE, label: 'Financeiro' },
    { id: PermissionModule.STOCK, label: 'Estoque' },
    { id: PermissionModule.PARTNERS, label: 'Parceiros' },
    { id: PermissionModule.REPORTS, label: 'Relatórios' },
    { id: PermissionModule.TEAM, label: 'Equipe' },
  ];

  const actionPermissions = [
    { id: PermissionModule.ACTION_EDIT, label: 'Edição de Registros' },
    { id: PermissionModule.ACTION_DELETE, label: 'Exclusão de Registros' },
    { id: PermissionModule.ACTION_CLOSE_CASHIER, label: 'Fechamentos e Sangrias' },
  ];

  return (
    <div className="space-y-8 pb-10 px-4 md:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3 text-white">
            <Shield className="text-brand-success" />
            {view === 'dashboard' ? 'Dashboard Master' : view === 'companies' ? 'Gestão de Empresas' : 'Modelos de Planos'}
          </h1>
          <p className="text-slate-400 font-medium mt-1 text-sm md:text-base">
            {view === 'dashboard' ? 'Visão global da infraestrutura e faturamento SaaS.' :
              view === 'companies' ? 'Controle total sobre clientes, vigências e permissões.' :
                'Definição comercial de planos e limites de acesso sincronizados com o Supabase.'}
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          {view === 'plans' && (
            <button onClick={() => setPlanModal({ show: true, mode: 'create', data: { name: '', price: 0, maxUsers: 1, modules: [], billing_cycle: 'monthly', is_active: true } })} className="bg-brand-success text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-success/20 transition-transform active:scale-95 flex-1 md:flex-none">
              <Plus size={18} /> <span className="whitespace-nowrap">Criar Plano</span>
            </button>
          )}
          <button onClick={loadData} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700">
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Visão de Dashboard */}
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="enterprise-card p-6 bg-brand-success/5 border-brand-success/10 group">
              <div className="flex justify-between items-start mb-2">
                <TrendingUp className="text-brand-success group-hover:scale-110 transition-transform" size={24} />
                <span className="text-[10px] font-bold text-brand-success bg-brand-success/10 px-2 py-0.5 rounded-full">GLOBAL</span>
              </div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">MRR Acumulado</p>
              <h3 className="text-2xl font-black text-brand-success mt-1">R$ {stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <div className="w-full bg-slate-800 h-1 mt-4 rounded-full overflow-hidden">
                <div className="bg-brand-success h-full" style={{ width: '75%' }}></div>
              </div>
            </div>

            <div className="enterprise-card p-6 border-slate-800">
              <Building2 className="text-blue-400 mb-2" size={24} />
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Contas Ativas</p>
              <h3 className="text-2xl font-bold text-white mt-1">{stats.active} <span className="text-xs text-slate-500 font-normal">empresas</span></h3>
              <p className="text-[10px] text-slate-500 mt-1">Pagamentos regulares</p>
            </div>

            <div className="enterprise-card p-6 border-brand-warning/20 bg-brand-warning/5">
              <Clock className="text-brand-warning mb-2" size={24} />
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Em Trial (30d)</p>
              <h3 className="text-2xl font-bold text-brand-warning mt-1">{stats.trial} <span className="text-xs text-slate-500 font-normal">pendentes</span></h3>
              <p className="text-[10px] text-slate-500 mt-1">Conversão esperada de 15%</p>
            </div>

            <div className="enterprise-card p-6 border-brand-error/20 bg-brand-error/5">
              <ShieldAlert className="text-brand-error mb-2" size={24} />
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Inadimplentes</p>
              <h3 className="text-2xl font-bold text-brand-error mt-1">{stats.blocked} <span className="text-xs text-slate-500 font-normal">bloqueadas</span></h3>
              <p className="text-[10px] text-slate-500 mt-1">Acesso suspenso via sistema</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 enterprise-card p-8">
              <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Projeção de Faturamento (Recorrência)</h3>
                <ActivityIcon size={18} className="text-brand-success animate-pulse" />
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Jan', value: 12000 },
                    { name: 'Fev', value: 15400 },
                    { name: 'Mar', value: 18900 },
                    { name: 'Abr', value: stats.mrr },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#020617', border: '1px solid #1E293B', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                    />
                    <Bar dataKey="value" fill="#10B981" radius={[6, 6, 0, 0]} barSize={50}>
                      {[0, 1, 2, 3].map((entry, index) => (
                        <Cell key={`cell-${index}`} fillOpacity={index === 3 ? 1 : 0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="enterprise-card p-8 bg-brand-dark/50">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-800 pb-4">Log Master Recente</h3>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-3 text-[11px] border-l-2 border-brand-success pl-3 py-1 text-slate-300">
                    <div className="text-slate-500 font-mono">10:4{i}</div>
                    <div>
                      <span className="text-brand-success font-bold">MASTER</span> editou vigência da <span className="text-white">EcoRecicla Matriz</span>
                    </div>
                  </div>
                ))}
                <button className="w-full py-2 mt-4 text-[10px] uppercase font-bold text-slate-500 hover:text-white transition-colors">Ver Auditoria SaaS</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visão de Gestão de Empresas */}
      {view === 'companies' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="enterprise-card p-4 flex items-center gap-4 max-w-xl group focus-within:border-brand-success transition-all mx-1">
            <Search size={20} className="text-slate-500 group-focus-within:text-brand-success" />
            <input
              type="text"
              placeholder="Localizar empresa por CNPJ ou nome fantasia..."
              className="bg-transparent border-none outline-none text-white text-sm flex-1 placeholder:text-slate-600"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="enterprise-card overflow-hidden shadow-2xl mx-1 relative">
            {isLoading && (
              <div className="absolute inset-0 bg-brand-dark/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-brand-success" size={48} />
              </div>
            )}

            {/* CABEÇALHO TABELA (SYNC) */}
            <div
              ref={headerScrollRef}
              onScroll={() => handleSyncScroll('header')}
              className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-900/40 border-b border-slate-800"
            >
              <table className="w-full text-left min-w-[1150px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                    <th className="px-6 py-5 w-[25%]">Entidade / Identificação</th>
                    <th className="px-6 py-5 w-[15%]">Data de Criação</th>
                    <th className="px-6 py-5 w-[15%]">Assinatura Atual</th>
                    <th className="px-6 py-5 w-[15%]">Data de Expiração</th>
                    <th className="px-6 py-5 w-[15%]">Status do Acesso</th>
                    <th className="px-6 py-5 text-right w-[15%]">Operações</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* BARRA DE ROLAGEM SYNC */}
            <div
              ref={topScrollRef}
              onScroll={() => handleSyncScroll('top')}
              className="overflow-x-auto h-2 md:h-3 no-print bg-slate-900/60 border-b border-slate-800"
            >
              <div style={{ width: '1150px', height: '1px' }}></div>
            </div>

            {/* CORPO TABELA (SYNC) */}
            <div
              ref={tableContainerRef}
              onScroll={() => handleSyncScroll('table')}
              className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <table className="w-full text-left min-w-[1150px] table-fixed">
                <tbody className="divide-y divide-slate-800/50">
                  {filteredCompanies.map(company => {
                    const pId = company.planId || company.plan_id;
                    const plan = plans.find(p => p.id === pId);
                    const expiryDate = company.expiresAt || company.expires_at || '';
                    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
                    const createdAt = company.created_at || company.createdAt;

                    return (
                      <tr key={company.id} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="px-6 py-4 w-[25%]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-brand-success transition-colors">
                              <Building2 size={16} />
                            </div>
                            <div className="truncate">
                              <p className="font-bold text-sm text-slate-200 truncate uppercase">{company.name}</p>
                              <p className="text-[10px] font-mono text-slate-500">{company.cnpj}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 w-[15%]">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                            <Clock size={12} />
                            {createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : '---'}
                          </div>
                        </td>
                        <td className="px-6 py-4 w-[15%]">
                          <div className="flex flex-col">
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase w-fit border border-indigo-500/20">
                              {plan?.name || 'CARREGANDO...'}
                            </span>
                            <span className="text-[9px] text-slate-500 mt-1 uppercase">R$ {plan?.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}/mês</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 w-[15%]">
                          <div className={`flex items-center gap-2 text-xs font-medium ${isExpired ? 'text-brand-error' : 'text-slate-400'}`}>
                            <Calendar size={12} />
                            {expiryDate ? new Date(expiryDate).toLocaleDateString('pt-BR') : '---'}
                            {isExpired && <span className="text-[8px] bg-brand-error/20 px-1 rounded uppercase ml-1 font-black">Vencido</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 w-[15%]">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${company.status === 'active' ? 'bg-brand-success/10 text-brand-success border-brand-success/30' :
                            company.status === 'trial' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/30' :
                              'bg-brand-error/10 text-brand-error border-brand-error/30'
                            }`}>
                            {company.status === 'active' ? 'Ativo' : company.status === 'trial' ? 'Em Trial' : 'Bloqueado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right w-[15%]">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setCompanyModal({ show: true, data: company })}
                              className="p-2.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                              title="Ações de Gestão"
                            >
                              <Settings size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteCompany(company.id)}
                              className="p-2.5 rounded-lg text-slate-500 hover:text-brand-error hover:bg-brand-error/10 transition-all"
                              title="Remover Registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-600 italic text-sm">Nenhuma empresa localizada no Banco Cloud.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Visão de Modelos de Planos */}
      {view === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {plans.map(plan => (
            <div key={plan.id} className={`enterprise-card p-8 flex flex-col justify-between group hover:border-brand-success/50 transition-all border-slate-800 relative overflow-hidden ${!plan.is_active ? 'opacity-60 grayscale' : ''}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-success/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3.5 rounded-2xl bg-brand-success/10 text-brand-success shadow-inner ${!plan.is_active ? 'text-slate-500 bg-slate-800/50' : ''}`}>
                    <Zap size={28} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setPlanModal({ show: true, mode: 'edit', data: plan })} className="p-2 text-slate-400 hover:text-white transition-colors" title="Editar"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-brand-error transition-colors" title="Excluir"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                  {!plan.is_active && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700">Inativo</span>}
                </div>
                <div className="flex items-baseline gap-1 my-5">
                  <span className="text-slate-500 text-sm font-bold">R$</span>
                  <span className="text-4xl font-black text-brand-success">{plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">/ {plan.billing_cycle === 'yearly' ? 'anual' : 'mensal'}</span>
                </div>

                <div className="space-y-4 mt-8 pt-6 border-t border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Configuração do Modelo</p>

                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-brand-success"><UsersIcon size={12} /></div>
                    Limite de <span className="text-white font-bold mx-0.5">{plan.maxUsers}</span> usuários
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-brand-success"><CheckCircle2 size={12} /></div>
                    <span className="text-white font-bold">{plan.modules.filter(m => !m.toString().includes('ACTION_')).length}</span> Módulos Habilitados
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-brand-warning"><Lock size={12} /></div>
                    <span className="text-white font-bold">{plan.modules.filter(m => m.toString().includes('ACTION_')).length}</span> Travas de Ação
                  </div>
                </div>
              </div>

              <button
                onClick={() => setPlanModal({ show: true, mode: 'edit', data: plan })}
                className="mt-10 w-full py-4 rounded-xl border border-slate-800 font-bold text-[11px] uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all shadow-sm text-slate-400"
              >
                Ajustar Configurações
              </button>
            </div>
          ))}

          {plans.length === 0 && !isLoading && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl opacity-50">
              <Zap size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Nenhum plano comercial definido.</p>
            </div>
          )}

          {isLoading && (
            <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-brand-success" size={40} />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Acessando Supabase...</p>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL DE GESTÃO DE EMPRESA --- */}
      {companyModal.show && companyModal.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 overflow-y-auto">
          <div className="enterprise-card w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                <Building2 size={24} className="text-brand-success" />
                Gerenciamento Corporativo
              </h2>
              <button onClick={() => setCompanyModal({ show: false, data: null })} className="text-slate-500 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateCompany} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data de Expiração (Vigência)</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white outline-none focus:ring-1 focus:ring-brand-success font-medium"
                    value={companyModal.data.expiresAt || companyModal.data.expires_at}
                    onChange={e => setCompanyModal({ show: true, data: { ...companyModal.data!, expiresAt: e.target.value, expires_at: e.target.value } })}
                  />
                  <p className="text-[10px] text-slate-500">O sistema bloqueia o login 24h após esta data.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status do Assinante</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white outline-none focus:ring-1 focus:ring-brand-success font-bold"
                    value={companyModal.data.status}
                    onChange={e => setCompanyModal({ show: true, data: { ...companyModal.data!, status: e.target.value as any } })}
                  >
                    <option value="active" className="text-brand-success">CONTRATO ATIVO</option>
                    <option value="trial" className="text-brand-warning">MODO TRIAL / TESTE</option>
                    <option value="blocked" className="text-brand-error">CONTA SUSPENSA / BLOQUEADA</option>
                  </select>
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Alterar Plano Escolhido</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white outline-none focus:ring-1 focus:ring-brand-success"
                    value={companyModal.data.planId || companyModal.data.plan_id}
                    onChange={e => setCompanyModal({ show: true, data: { ...companyModal.data!, planId: e.target.value, plan_id: e.target.value } })}
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - (R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <ShieldAlert size={18} className="text-brand-warning" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Impacto das Alterações</span>
                </div>
                <ul className="space-y-2">
                  <li className="text-[11px] text-slate-500 flex items-start gap-2">
                    <div className="w-1 h-1 bg-brand-success rounded-full mt-1.5 flex-shrink-0"></div>
                    Mudanças de status bloqueiam/liberam acesso em tempo real para todos os funcionários desta empresa.
                  </li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-2">
                    <div className="w-1 h-1 bg-brand-success rounded-full mt-1.5 flex-shrink-0"></div>
                    Mudar o plano altera instantaneamente os módulos e limites permitidos para a empresa.
                  </li>
                </ul>
              </div>

              <div className="pt-8 border-t border-slate-800 flex gap-4">
                <button type="button" onClick={() => setCompanyModal({ show: false, data: null })} className="flex-1 py-4 border border-slate-800 rounded-xl font-bold uppercase text-xs hover:bg-slate-800 transition-colors text-slate-400">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-brand-success text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-brand-success/20 hover:scale-[1.02] transition-all">Efetivar Alterações Master</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE GESTÃO DE PLANOS --- */}
      {planModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 overflow-y-auto">
          <div className="enterprise-card w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                <Zap size={24} className="text-brand-success" />
                {planModal.mode === 'create' ? 'Novo Modelo de Plano' : 'Editar Modelo'}
              </h2>
              <button onClick={() => setPlanModal({ show: false, mode: 'create', data: null })} className="text-slate-500 hover:text-white"><X size={24} /></button>
            </div>

            <form onSubmit={handleSavePlan} className="flex flex-col md:flex-row h-[70vh]">
              {/* Lado Esquerdo - Configurações Básicas */}
              <div className="w-full md:w-1/3 border-r border-slate-800 p-6 space-y-6 overflow-y-auto bg-slate-950/30">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Plano</label>
                  <input
                    type="text" required placeholder="Ex: Enterprise Gold"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-brand-success font-bold"
                    value={planModal.data?.name || ''}
                    onChange={e => setPlanModal({ ...planModal, data: { ...planModal.data, name: e.target.value } })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Valor (R$)</label>
                    <input
                      type="number" step="0.01" required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-brand-success font-mono"
                      value={planModal.data?.price || 0}
                      onChange={e => setPlanModal({ ...planModal, data: { ...planModal.data, price: parseFloat(e.target.value) } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ciclo</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-brand-success text-xs"
                      value={planModal.data?.billing_cycle || 'monthly'}
                      onChange={e => setPlanModal({ ...planModal, data: { ...planModal.data, billing_cycle: e.target.value as 'monthly' | 'yearly' } })}
                    >
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Máximo de Usuários</label>
                  <input
                    type="number" min="1" required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-brand-success"
                    value={planModal.data?.maxUsers || 1}
                    onChange={e => setPlanModal({ ...planModal, data: { ...planModal.data, maxUsers: parseInt(e.target.value) } })}
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
                  <input
                    type="checkbox" id="isActivePlan"
                    className="w-5 h-5 accent-brand-success rounded cursor-pointer"
                    checked={planModal.data?.is_active ?? true}
                    onChange={e => setPlanModal({ ...planModal, data: { ...planModal.data, is_active: e.target.checked } })}
                  />
                  <label htmlFor="isActivePlan" className="text-sm font-bold text-white cursor-pointer select-none">
                    Plano Ativo para Venda?
                  </label>
                </div>
              </div>

              {/* Lado Direito - Módulos */}
              <div className="flex-1 p-8 flex flex-col h-full bg-slate-900/10">
                <div className="flex-1 overflow-y-auto pr-2">
                  <h3 className="text-xs font-black uppercase text-brand-success mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} /> Módulos Operacionais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                    {operationalModules.map(mod => {
                      const isChecked = (planModal.data?.modules || []).includes(mod.id);
                      return (
                        <label key={mod.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-brand-success/10 border-brand-success text-white' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const current = planModal.data?.modules || [];
                              const newModules = isChecked ? current.filter(m => m !== mod.id) : [...current, mod.id];
                              setPlanModal({ ...planModal, data: { ...planModal.data, modules: newModules } });
                            }}
                            className="hidden"
                          />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isChecked ? 'border-brand-success bg-brand-success text-black' : 'border-slate-600'}`}>
                            {isChecked && <Check size={10} strokeWidth={4} />}
                          </div>
                          <span className="text-xs font-bold uppercase">{mod.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <h3 className="text-xs font-black uppercase text-red-400 mb-4 flex items-center gap-2">
                    <Lock size={16} /> Permissões Sensíveis (Travas)
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {actionPermissions.map(perm => {
                      const isChecked = (planModal.data?.modules || []).includes(perm.id);
                      return (
                        <label key={perm.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-red-500/10 border-red-500/50 text-red-200' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const current = planModal.data?.modules || [];
                              const newModules = isChecked ? current.filter(m => m !== perm.id) : [...current, perm.id];
                              setPlanModal({ ...planModal, data: { ...planModal.data, modules: newModules } });
                            }}
                            className="hidden"
                          />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isChecked ? 'border-red-500 bg-red-500 text-white' : 'border-slate-600'}`}>
                            {isChecked && <Check size={10} strokeWidth={4} />}
                          </div>
                          <span className="text-xs font-bold uppercase">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setPlanModal({ show: false, mode: 'create', data: null })} className="px-6 py-4 rounded-xl font-bold uppercase text-xs hover:bg-slate-800 transition-colors text-slate-400">Cancelar</button>
                  <button type="submit" className="px-8 py-4 bg-brand-success text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-brand-success/20 hover:scale-[1.02] transition-all flex items-center gap-2">
                    <Save size={18} /> Salvar Modelo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaasAdmin;