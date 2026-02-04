
import React from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { FinancialRecord, Transaction, Material } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils/currencyHelper';

const Dashboard: React.FC = () => {
  const { currentUser } = useAppContext();
  const companyId = currentUser?.companyId || '';

  const financials = db.queryTenant<FinancialRecord>('financials', companyId);
  const transactions = db.queryTenant<Transaction>('transactions', companyId);
  const materials = db.queryTenant<Material>('materials', companyId);

  const totalReceivable = financials
    .filter(f => (f.tipo === 'vendas' || f.tipo === 'pagamento' || f.tipo === 'entrada') && f.status !== 'paid')
    .reduce((sum, f) => sum + f.valor, 0);

  const totalPayable = financials
    .filter(f => (f.tipo === 'compras' || f.tipo === 'despesa' || f.tipo === 'sangria') && f.status !== 'paid')
    .reduce((sum, f) => sum + f.valor, 0);

  // Fix: Property 'tipo' does not exist on type 'Transaction'. Changed to use 'natureza' property which exists on Transaction type.
  // In POS system, selling materials is recorded as nature 'ENTRADA' (incoming payment context).
  const totalSales = transactions
    .filter(t => t.natureza === 'ENTRADA')
    .reduce((sum, t) => sum + t.valor, 0);

  const lowStock = materials.filter(m => m.stock <= (m.minStock || 0));

  const chartData = [
    { name: 'Jan', value: 4000 },
    { name: 'Fev', value: 3000 },
    { name: 'Mar', value: 2000 },
    { name: 'Abr', value: 2780 },
    { name: 'Mai', value: 1890 },
    { name: 'Jun', value: totalSales },
  ];

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, color }: any) => (
    <div className="enterprise-card p-6 flex flex-col gap-5 bg-slate-900/10 border-slate-800">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-2xl bg-${color}/10 text-${color} border border-${color}/20`}><Icon size={24} /></div>
        <div className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${trend === 'up' ? 'text-brand-success' : 'text-brand-error'}`}>{trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}<span>{trendValue}</span></div>
      </div>
      <div><p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{title}</p><h3 className="text-3xl md:text-2xl font-black mt-2 text-white">R$ {formatCurrency(value)}</h3></div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      <header className="px-1"><h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 text-white uppercase tracking-tight"><Activity className="text-brand-success" /> Dashboard</h1></header>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-1">
        <StatCard title="Receitas Pendentes" value={totalReceivable} icon={TrendingUp} trend="up" trendValue="+12%" color="brand-success" />
        <StatCard title="Despesas em Aberto" value={totalPayable} icon={TrendingDown} trend="down" trendValue="-5%" color="brand-error" />
        <StatCard title="Faturamento do Mês" value={totalSales} icon={DollarSign} trend="up" trendValue="OK" color="brand-success" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-1">
        <div className="lg:col-span-2 enterprise-card p-8 border-slate-800">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1E293B', borderRadius: '8px' }}
                  cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                />
                <Bar dataKey="value" fill="#10B981" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
