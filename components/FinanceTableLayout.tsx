import React from 'react';
import { db } from '../services/dbService';
import { FinancialRecord, Partner, CashierSession } from '../types';

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

import { Pencil as IconEdit, Trash2 as IconTrash, RotateCcw } from 'lucide-react';

export const TableLayout = ({
    title,
    items,
    icon: Icon,
    iconColor,
    partners,
    activeSession,
    isLiquidating,
    setLiquidationModal,
    onEdit,
    onDelete,
    onReverse
}: {
    title: string,
    items: FinancialRecord[],
    icon: any,
    iconColor: string,
    partners: Partner[],
    activeSession: CashierSession | null,
    isLiquidating: boolean,
    setLiquidationModal: (data: any) => void,
    onEdit?: (record: FinancialRecord) => void,
    onDelete?: (record: FinancialRecord) => void,
    onReverse?: (record: FinancialRecord) => void
}) => {
    return (
        <div className="enterprise-card overflow-hidden shadow-2xl border-slate-800 mb-8 bg-slate-900/40">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Icon className={iconColor} size={18} /> {title}
                </h2>
            </div>
            <div className="overflow-x-auto scrollbar-thick">
                <table className="w-full text-left min-w-[1000px]">
                    <thead>
                        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest bg-slate-900/40">
                            <th className="px-6 py-5">Turno (ID)</th>
                            <th className="px-6 py-5">Vencimento</th>
                            <th className="px-6 py-5">Parceiro</th>
                            <th className="px-6 py-5">Identificação</th>
                            <th className="px-6 py-5 text-right">Valor Bruto</th>
                            <th className="px-6 py-5 text-center">Status</th>
                            <th className="px-6 py-5 text-right no-print">Operacional</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {items.map(record => {
                            const statusInfo = getStatusInfo(record);
                            const partner = partners.find(p => p.id === record.parceiro_id);
                            return (
                                <tr key={record.id} className="hover:bg-slate-800/20 transition-all text-xs font-medium">
                                    <td className="px-6 py-4 font-mono text-slate-500 text-[10px]">{record.caixa_id ? `#${record.caixa_id.slice(0, 8).toUpperCase()}` : '---'}</td>
                                    <td className="px-6 py-4 font-mono text-slate-400">{record.dueDate || record.due_date || '---'}</td>
                                    <td className="px-6 py-4 truncate max-w-[200px] uppercase text-slate-200 font-bold">{partner?.name || 'CONSUMIDOR FINAL'}</td>
                                    <td className="px-6 py-4 truncate max-w-[300px] uppercase text-slate-400">{record.description}</td>
                                    <td className={`px-6 py-4 text-right font-black ${record.natureza === 'ENTRADA' ? 'text-brand-success' : 'text-brand-error'}`}>R$ {record.valor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase border shadow-sm ${statusInfo.color}`}>{statusInfo.label}</span></td>
                                    <td className="px-6 py-4 text-right no-print flex items-center justify-end gap-2">
                                        {(!record.transaction_id && record.tipo !== 'vendas' && record.tipo !== 'compras') && (
                                            <>
                                                <button
                                                    onClick={() => onEdit && onEdit(record)}
                                                    className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-all"
                                                    title="Editar"
                                                >
                                                    <IconEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete && onDelete(record)}
                                                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                                                    title="Excluir"
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            </>
                                        )}
                                        {record.status === 'paid' && onReverse && (
                                            <button
                                                onClick={() => onReverse(record)}
                                                className="p-2 rounded-lg text-brand-warning hover:bg-brand-warning/10 transition-all font-black uppercase text-[10px]"
                                                title="Estornar Liquidação"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                        <button
                                            disabled={!activeSession || isLiquidating || record.status === 'paid' || record.status === 'reversed'}
                                            onClick={() => setLiquidationModal({ show: true, record, termId: '', dueDate: record.dueDate || record.due_date || db.getToday(), receivedValue: '' })}
                                            className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg transition-all ${!activeSession || record.status === 'paid' || record.status === 'reversed' ? 'bg-slate-800 text-slate-600' : 'bg-brand-success text-white hover:scale-105'}`}
                                        >
                                            Baixar
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr><td colSpan={6} className="py-20 text-center text-slate-600 italic uppercase font-bold text-[10px]">Nenhum título localizado com os filtros aplicados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TableLayout;
