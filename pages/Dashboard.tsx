
import React, { useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { FinancialRecord, Transaction, Material, PermissionModule } from '../types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Package,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { formatCurrency } from '../utils/currencyHelper';

// Cores Premium
const COLORS = {
  primary: '#10B981',   // Emerald 500
  secondary: '#3B82F6', // Blue 500
  accent: '#8B5CF6',    // Violet 500
  danger: '#EF4444',    // Red 500
  warning: '#F59E0B',   // Amber 500
  info: '#06B6D4',      // Cyan 500
  dark: '#0F172A',      // Slate 900
  card: 'rgba(30, 41, 59, 0.5)', // Slate 800/50
  text: '#94A3B8'       // Slate 400
};

const PIE_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'
];

const Dashboard: React.FC = () => {
  const { currentUser } = useAppContext();
  const companyId = currentUser?.companyId || '';

  // --- DATA FETCHING ---
  const financials = db.queryTenant<FinancialRecord>('financials', companyId);
  const transactions = db.queryTenant<Transaction>('transactions', companyId);
  const materials = db.queryTenant<Material>('materials', companyId);

  // --- DATA PROCESSING ---

  // 1. DATES RANGE (Last 6 months)
  const today = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(d.toLocaleString('pt-BR', { month: 'short' }));
  }

  // 2. FINANCIAL SUMMARY
  const receivables = financials.filter(f =>
    (f.tipo === 'vendas' || f.tipo === 'pagamento' || f.tipo === 'entrada') &&
    f.status !== 'paid' && f.status !== 'reversed'
  ).reduce((sum, f) => sum + f.valor, 0);

  const payables = financials.filter(f =>
    (f.tipo === 'compras' || f.tipo === 'despesa' || f.tipo === 'sangria') &&
    f.status !== 'paid' && f.status !== 'reversed'
  ).reduce((sum, f) => sum + f.valor, 0);

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthlyRevenue = financials
    .filter(f => {
      const d = f.due_date ? new Date(f.due_date) : new Date(f.created_at);
      return d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        (f.tipo === 'vendas' || f.tipo === 'entrada') &&
        f.status === 'paid';
    })
    .reduce((sum, f) => sum + f.valor, 0);

  // 3. CHART DATA: FINANCIAL HISTORY (Last 6 months)
  const financialHistoryData = useMemo(() => {
    return months.map((monthName, index) => {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      const m = monthDate.getMonth();
      const y = monthDate.getFullYear();

      const income = financials
        .filter(f => {
          const d = f.due_date ? new Date(f.due_date) : new Date(f.created_at);
          return d.getMonth() === m && d.getFullYear() === y &&
            ['vendas', 'entrada', 'pagamento'].includes(f.tipo) &&
            f.status !== 'reversed';
        })
        .reduce((sum, f) => sum + f.valor, 0);

      const expense = financials
        .filter(f => {
          const d = f.due_date ? new Date(f.due_date) : new Date(f.created_at);
          return d.getMonth() === m && d.getFullYear() === y &&
            ['compras', 'despesa', 'sangria'].includes(f.tipo) &&
            f.status !== 'reversed';
        })
        .reduce((sum, f) => sum + f.valor, 0);

      return {
        name: monthName,
        Receitas: income,
        Despesas: expense,
      };
    });
  }, [financials]);

  // 4. CHART DATA: EXPENSES BY CATEGORY (Pie)
  const expenseByCategoryData = useMemo(() => {
    const expenses = financials.filter(f =>
      ['despesa', 'compras'].includes(f.tipo) && f.status !== 'reversed'
    );

    const categoryMap = new Map<string, number>();
    expenses.forEach(f => {
      const cat = f.categoria || 'Outros';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + f.valor);
    });

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }, [financials]);

  // 5. STOCK SUMMARY
  const totalStockValue = materials.reduce((sum, m) => sum + (m.stock * m.buyPrice), 0);
  const lowStockItems = materials.filter(m => m.stock <= (m.minStock || 0)).length;

  // 6. CHART DATA: STOCK DISTRIBUTION (Pie/Bar alternative) - Top 5 Materials by Value
  const topStockMaterials = useMemo(() => {
    return materials
      .map(m => ({ name: m.name, value: m.stock * m.buyPrice }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [materials]);

  // 7. CHART DATA: LAST 7 DAYS FINANCIALS
  const dailyFinancials = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    return days.map(day => {
      const dayStr = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const income = financials
        .filter(f => {
          const d = f.due_date ? new Date(f.due_date) : new Date(f.created_at);
          return d.getDate() === day.getDate() &&
            d.getMonth() === day.getMonth() &&
            d.getFullYear() === day.getFullYear() &&
            ['vendas', 'entrada', 'pagamento'].includes(f.tipo) &&
            f.status !== 'reversed';
        })
        .reduce((sum, f) => sum + f.valor, 0);

      const expense = financials
        .filter(f => {
          const d = f.due_date ? new Date(f.due_date) : new Date(f.created_at);
          return d.getDate() === day.getDate() &&
            d.getMonth() === day.getMonth() &&
            d.getFullYear() === day.getFullYear() &&
            ['compras', 'despesa', 'sangria'].includes(f.tipo) &&
            f.status !== 'reversed';
        })
        .reduce((sum, f) => sum + f.valor, 0);

      return { name: dayStr, Receitas: income, Despesas: expense };
    });
  }, [financials]);


  // --- COMPONENTS ---

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, color, subValue }: any) => (
    <div className="relative overflow-hidden p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl group hover:border-slate-700 transition-all duration-300">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}`}>
        <Icon size={80} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-${color}/10 text-${color} border border-${color}/20`}>
            <Icon size={24} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-${trend === 'up' ? 'emerald' : 'rose'}-500/10 text-${trend === 'up' ? 'emerald' : 'rose'}-500`}>
              {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {trendValue}
            </div>
          )}
        </div>
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
        <p className="text-2xl md:text-3xl font-black text-white">{typeof value === 'number' ? `R$ ${formatCurrency(value)}` : value}</p>
        {subValue && <p className="text-xs text-slate-500 mt-2 font-medium">{subValue}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen space-y-8 animate-in fade-in duration-500 pb-20">

      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Activity className="text-emerald-500" size={32} />
            DASHBOARD
          </h1>
          <p className="text-slate-400 mt-1">Visão geral do sistema em tempo real</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
            Últimos 30 dias
          </button>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all">
            Atualizar Dados
          </button>
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
        <StatCard
          title="Faturamento (Mês)"
          value={monthlyRevenue}
          icon={DollarSign}
          trend="up"
          trendValue="+12.5%"
          color="emerald-500"
          subValue="vs. mês anterior"
        />
        <StatCard
          title="Contas a Receber"
          value={receivables}
          icon={TrendingUp}
          color="blue-500"
          subValue={`${financials.filter(f => f.tipo === 'vendas' && f.status === 'pending').length} títulos pendentes`}
        />
        <StatCard
          title="Contas a Pagar"
          value={payables}
          icon={TrendingDown}
          trend="down"
          trendValue="-2.4%"
          color="rose-500"
          subValue="Vencendo nos próximos 7 dias"
        />
        <StatCard
          title="Valor em Estoque"
          value={totalStockValue}
          icon={Package}
          color="amber-500"
          subValue={`${materials.length} itens cadastrados`}
        />
      </div>

      {/* DAILY CHART ROW */}
      <div className="px-1">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="text-indigo-500" size={20} />
                Movimentação Diária
              </h3>
              <p className="text-slate-400 text-sm">Receitas vs Despesas (Últimos 7 dias)</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyFinancials} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={12}
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={(value: number) => [`R$ ${formatCurrency(value)}`, '']}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="Receitas" fill={COLORS.secondary} radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="Despesas" fill={COLORS.warning} radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* MAIN CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-1">

        {/* MAIN BAR CHART: REVENUE VS EXPENSES */}
        <div className="lg:col-span-2 bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="text-emerald-500" size={20} />
                Fluxo Financeiro
              </h3>
              <p className="text-slate-400 text-sm">Comparativo Receitas vs Despesas (Últimos 6 meses)</p>
            </div>
            <div className="flex gap-4 text-xs font-medium">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Receitas
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span> Despesas
              </div>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={12}
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={(value: number) => [`R$ ${formatCurrency(value)}`, '']}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="Receitas" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Despesas" fill={COLORS.danger} radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PIE CHART: EXPENSES BREAKDOWN */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
            <PieChartIcon className="text-blue-500" size={20} />
            Despesas por Categoria
          </h3>
          <p className="text-slate-400 text-sm mb-6">Onde o dinheiro está sendo gasto</p>

          <div className="flex-1 min-h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseByCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(15, 23, 42, 1)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${formatCurrency(value)}`}
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span style={{ color: '#94A3B8', fontSize: '12px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            {expenseByCategoryData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                Sem dados de despesas
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECONDARY ROW: STOCK & QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-1">

        {/* STOCK ALERTS */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              Alertas de Estoque
            </h3>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-xs font-bold rounded-full">
              {lowStockItems} Críticos
            </span>
          </div>

          <div className="space-y-4">
            {materials.filter(m => m.stock <= (m.minStock || 0)).slice(0, 4).map(material => (
              <div key={material.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{material.name}</p>
                    <p className="text-xs text-slate-500">Mínimo: {material.minStock} {material.unit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-rose-500">{material.stock} {material.unit}</p>
                  <p className="text-[10px] text-rose-500/70 uppercase font-bold">Abaixo</p>
                </div>
              </div>
            ))}

            {lowStockItems === 0 && (
              <div className="text-center py-8 text-slate-500 italic">
                Nenhum item com estoque baixo.
              </div>
            )}
          </div>
        </div>

        {/* STOCK VALUE DISTRIBUTION */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <Wallet className="text-purple-500" size={20} />
            Top 5 Itens (Valor)
          </h3>
          <div className="space-y-4">
            {topStockMaterials.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <span className="text-slate-400">R$ {formatCurrency(item.value)}</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.value / topStockMaterials[0].value) * 100}%`,
                      backgroundColor: COLORS.accent
                    }}
                  ></div>
                </div>
              </div>
            ))}
            {topStockMaterials.length === 0 && (
              <div className="text-center py-8 text-slate-500 italic">
                Estoque vazio.
              </div>
            )}
          </div>
        </div>

        {/* RECENT ACTIVITY (Placeholder for visually completing the layout) */}
        <div className="bg-[#1E293B]/50 border border-slate-700/50 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
            <Activity size={32} />
          </div>
          <h3 className="text-white font-bold mb-2">Atalhos Rápidos</h3>
          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <button className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold transition-all">
              Nova Venda
            </button>
            <button className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold transition-all">
              Nova Compra
            </button>
            <button className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold transition-all">
              Novo Parceiro
            </button>
            <button className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold transition-all">
              Relatórios
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
