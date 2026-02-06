import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DEFAULT_PERMISSIONS, DEFAULT_AUTHORIZATIONS } from '../utils/permissions';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { User, PermissionModule, UserRole, OperationalProfile, AuthorizationRequest, RemoteAuthorization } from '../types';
import RequestAuthorizationModal from '../components/RequestAuthorizationModal';
import {
  Plus,
  UserPlus,
  Shield,
  Mail,
  Trash2,
  Edit2,
  X,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Link,
  CheckCircle2,
  Clock,
  Save,
  Key,
  AlertTriangle,
  Users2,
  ShieldCheck as ShieldCheckIcon,
  Contact2,
  User as UserIconNormal,
  CreditCard as CreditCardIcon,
  ShoppingBag,
  BarChart3,
  Package,
  Crown
} from 'lucide-react';

const Users: React.FC = () => {
  const { currentUser, pendingRequests, refreshRequests } = useAppContext();
  const companyId = currentUser?.companyId || '';
  const isCurrentSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userModal, setUserModal] = useState<{ show: boolean, data: User | null }>({ show: false, data: null });
  const [isCopied, setIsCopied] = useState(false);
  // Multi-Profile State
  const [inviteProfiles, setInviteProfiles] = useState<OperationalProfile[]>([OperationalProfile.VENDEDOR]);
  const [editProfiles, setEditProfiles] = useState<OperationalProfile[]>([]);

  // Helper to merge permissions
  const getCombinedPermissions = (profiles: OperationalProfile[]): PermissionModule[] => {
    const allPerms = new Set<PermissionModule>();
    profiles.forEach(p => {
      const perms = DEFAULT_PERMISSIONS[p] || [];
      perms.forEach(perm => allPerms.add(perm));
    });
    return Array.from(allPerms);
  };

  const getCombinedAuthorizations = (profiles: OperationalProfile[]): RemoteAuthorization[] => {
    const allAuths = new Set<RemoteAuthorization>();
    profiles.forEach(p => {
      const auths = DEFAULT_AUTHORIZATIONS[p] || [];
      auths.forEach(auth => allAuths.add(auth));
    });
    return Array.from(allAuths);
  };

  // CONTROLE DE PEDIDOS DE LIBERAÇÃO REMOTA
  const [isRequestAuthModalOpen, setIsRequestAuthModalOpen] = useState(false);
  const [authRequestData, setAuthRequestData] = useState<{ key: string, label: string } | null>(null);

  const [inviteForm, setInviteForm] = useState({ name: '', email: '', profile: OperationalProfile.VENDEDOR, permissions: [] as PermissionModule[], remote_authorizations: [] as RemoteAuthorization[] });
  const [editFormData, setEditFormData] = useState<Partial<User>>({});

  const loadData = useCallback(() => {
    const companyUsers = db.queryTenant<User>('users', companyId);
    const combinedUsers = isCurrentSuperAdmin ? [...db.query<User>('users', u => u.role === UserRole.SUPER_ADMIN), ...companyUsers] : companyUsers;
    const uniqueUsers = combinedUsers.filter((u, i, s) => i === s.findIndex((t) => t.id === u.id));
    setUsers(uniqueUsers); setInvites(db.queryTenant<any>('invites', companyId));
  }, [companyId, isCurrentSuperAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  // MONITOR DE LIBERAÇÕES REMOTAS (ACT AS BACKEND JOBS)
  useEffect(() => {
    if (!currentUser) return;
    const findApproved = (key: string) => db.query<AuthorizationRequest>('authorization_requests' as any, r => r.status === 'APPROVED' && r.action_key === key && r.requested_by_id === currentUser.id).sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())[0];

    const approvedEdit = findApproved('EDITAR_USUARIO');
    if (approvedEdit) {
      db.update('authorization_requests' as any, approvedEdit.id, { status: 'PROCESSED' } as any);
      const id = approvedEdit.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
      const dataRaw = approvedEdit.action_label.split('JSON: ')[1]?.trim();
      if (id && dataRaw) {
        db.update('users', id, JSON.parse(dataRaw)); loadData();
      }
    }
    const approvedDelete = findApproved('EXCLUIR_USUARIO');
    if (approvedDelete) {
      db.update('authorization_requests' as any, approvedDelete.id, { status: 'PROCESSED' } as any);
      const id = approvedDelete.action_label.split('REAL_ID: ')[1]?.split(' |')[0]?.trim();
      if (id) {
        db.delete('users', id); loadData();
      }
    }
  }, [pendingRequests, currentUser, loadData]);

  const handleDeleteInvite = async (id: string) => {
    if (confirm("Deseja realmente cancelar este convite? O código deixará de funcionar.")) {
      try {
        await db.delete('invites', id);
        loadData();
      } catch (err) {
        alert("Erro ao excluir convite.");
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModal.data) return;

    // Se for Super Admin, permite edição direta sem solicitação remota
    if (isCurrentSuperAdmin) {
      try {
        await db.update('users', userModal.data.id, editFormData);
        db.logAction(companyId, currentUser.id, currentUser.name, 'TEAM_EDIT', `Editou usuário ${userModal.data.name} (Bypass Super Admin)`);
        alert('Usuário atualizado com sucesso!');
        setUserModal({ show: false, data: null });
        loadData();
      } catch (err) {
        alert('Erro ao salvar alterações.');
      }
      return;
    }

    setAuthRequestData({
      key: 'EDITAR_USUARIO',
      label: `OP: EDIÇÃO DE ACESSO | ID: #${userModal.data.id.slice(-5)} | CTX: SEGURANÇA | DET: Reconfiguração das permissões e perfil do integrante ${userModal.data.name} para adequação de cargo. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${userModal.data.id} | JSON: ${JSON.stringify(editFormData)}`
    });
    setIsRequestAuthModalOpen(true); setUserModal({ show: false, data: null });
  };

  // Refs para sincronização de scroll horizontal (Padrão Master-Sync)
  const topScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div><h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 text-white uppercase tracking-tight"><ShieldCheckIcon className="text-brand-success" /> Equipe & Acessos</h1></div>
        <button onClick={() => setShowInviteModal(true)} className="bg-brand-success text-white py-4 px-8 rounded-2xl shadow-xl font-black flex items-center justify-center gap-3 text-sm uppercase tracking-widest transition-all">
          <UserPlus size={22} /><span>Convidar Integrante</span>
        </button>
      </header>

      <div className="space-y-8 px-1">
        {/* CARTOES DE USUARIOS ATIVOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map(user => {
            const isMaster = user.email === 'admin@sucatafacil.com' || user.role === UserRole.SUPER_ADMIN;
            const canManage = isCurrentSuperAdmin || (!isMaster && currentUser?.role === UserRole.COMPANY_ADMIN);
            return (
              <div key={user.id} className="enterprise-card p-6 flex flex-col justify-between group relative border-slate-800">
                <div className="flex items-center gap-5"><div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black ${isMaster ? 'bg-brand-success border-brand-success text-white' : 'bg-slate-800 border-slate-700 text-brand-success'}`}>{user.name.charAt(0)}</div><div className="flex-1 min-w-0"><h4 className="font-black text-lg truncate text-slate-100 uppercase tracking-tight">{user.name}</h4><p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{user.email}</p></div></div>
                <div className="mt-8 pt-5 border-t border-slate-800 flex justify-between items-center">
                  <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm">{user.profile}</span>
                  {canManage && (
                    <div className="flex gap-2">
                      {user.email !== 'admin@sucatafacil.com' && <button onClick={() => {
                        setEditFormData({ ...user });
                        // Validar se o perfil do usuário corresponde a um ou mais perfis padrão
                        const profileString = user.profile || '';
                        const currentProfiles = profileString.split(', ').filter(p =>
                          Object.values(OperationalProfile).includes(p as any)
                        ) as OperationalProfile[];

                        setEditProfiles(currentProfiles);
                        setUserModal({ show: true, data: user });
                      }} className="p-2.5 bg-slate-800 text-slate-400 rounded-xl"><Edit2 size={16} /></button>}
                      {user.email !== 'admin@sucatafacil.com' && <button onClick={() => {
                        setAuthRequestData({
                          key: 'EXCLUIR_USUARIO',
                          label: `OP: EXCLUSÃO DE USUÁRIO | ID: #${user.id.slice(-5)} | CTX: SEGURANÇA | DET: Revogação total do acesso ao sistema para o colaborador ${user.name} por desligamento. | VAL: R$ 0,00 para R$ 0,00 | REAL_ID: ${user.id}`
                        });
                        setIsRequestAuthModalOpen(true);
                      }} className="p-2.5 bg-brand-error/10 text-brand-error rounded-xl"><Trash2 size={16} /></button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* TABELA DE CONVITES (STANDARDIZED RESPONSIVE) */}
        <div className="enterprise-card overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Mail className="text-brand-success" size={18} /> Gestão de Convites Enviados
            </h3>
          </div>

          {/* CABEÇALHO TABELA (SYNC) */}
          <div
            ref={headerScrollRef}
            onScroll={() => handleSyncScroll('header')}
            className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-900/40 border-b border-slate-800"
          >
            <table className="w-full text-left min-w-[1000px] table-fixed">
              <thead>
                <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-6 py-4 w-[15%]">Data</th>
                  <th className="px-6 py-4 w-[15%]">Código</th>
                  <th className="px-6 py-4 w-[30%]">Nome / E-mail</th>
                  <th className="px-6 py-4 w-[15%]">Cargo</th>
                  <th className="px-6 py-4 w-[15%] text-center">Status</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* BARRA DE ROLAGEM SYNC (MOBILE) */}
          <div
            ref={topScrollRef}
            onScroll={() => handleSyncScroll('top')}
            className="overflow-x-auto h-2 no-print bg-slate-900/60 border-b border-slate-800"
          >
            <div style={{ width: '1000px', height: '1px' }}></div>
          </div>

          {/* CORPO TABELA (SYNC) */}
          <div
            ref={tableContainerRef}
            onScroll={() => handleSyncScroll('table')}
            className="overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <table className="w-full text-left min-w-[1000px] table-fixed">
              <tbody className="divide-y divide-slate-800/50">
                {invites.map(invite => (
                  <tr key={invite.id} className="hover:bg-slate-800/10 transition-colors text-xs font-medium">
                    <td className="px-6 py-4 w-[15%] text-slate-400 font-mono text-[10px]">
                      {invite.created_at ? new Date(invite.created_at).toLocaleDateString('pt-BR') : '---'}
                    </td>
                    <td className="px-6 py-4 w-[15%]">
                      <span className="px-2 py-1 bg-slate-800 rounded font-mono text-brand-success border border-brand-success/20 font-bold">{invite.code}</span>
                    </td>
                    <td className="px-6 py-4 w-[30%]">
                      <p className="text-slate-200 font-bold uppercase line-clamp-1">{invite.name}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-tighter truncate">{invite.email}</p>
                    </td>
                    <td className="px-6 py-4 w-[15%] text-slate-400 font-bold uppercase text-[10px]">{invite.profile}</td>
                    <td className="px-6 py-4 w-[15%] text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shadow-sm ${invite.status === 'accepted'
                        ? 'bg-brand-success/10 text-brand-success border-brand-success/20'
                        : 'bg-brand-warning/10 text-brand-warning border-brand-warning/20'
                        }`}>
                        {invite.status === 'accepted' ? 'Aceito' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
                {invites.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-600 italic uppercase font-bold text-[10px]">
                      Nenhum convite pendente localizado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {userModal.show && userModal.data && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border-slate-700">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center"><h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest"><Edit2 size={24} /> Editar Integrante</h2><button onClick={() => setUserModal({ show: false, data: null })} className="p-2 text-slate-500"><X size={32} /></button></div>
            <form onSubmit={handleSaveUser} className="p-8 pb-24 space-y-6" autoComplete="new-password">
              <div className="space-y-3">
                <label htmlFor="edit-user-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Colaborador</label>
                <input required id="edit-user-name" name="name" autoComplete="new-password" className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-brand-success" value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Nome Completo" />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Perfil de Acesso</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: OperationalProfile.VENDEDOR, label: 'Vendedor', icon: Contact2 },
                    { id: OperationalProfile.COMPRADOR, label: 'Comprador', icon: ShoppingBag },
                    { id: OperationalProfile.FINANCEIRO, label: 'Financeiro', icon: BarChart3 },
                    { id: OperationalProfile.ESTOQUE, label: 'Estoque', icon: Package },
                    { id: OperationalProfile.GERENTE, label: 'Gerente', icon: ShieldCheckIcon },
                    { id: OperationalProfile.MASTER, label: 'Master', icon: Crown },
                  ].map(p => {
                    const isSelected = editProfiles.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          const newProfiles = isSelected
                            ? editProfiles.filter(x => x !== p.id)
                            : [...editProfiles, p.id];
                          setEditProfiles(newProfiles);

                          const combinedPerms = getCombinedPermissions(newProfiles);
                          const combinedAuths = getCombinedAuthorizations(newProfiles);
                          setEditFormData({
                            ...editFormData,
                            profile: newProfiles.join(', ') || 'Personalizado',
                            permissions: combinedPerms,
                            remote_authorizations: combinedAuths
                          });
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center ${isSelected ? 'bg-brand-success/10 border-brand-success text-brand-success' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                      >
                        <p.icon size={24} />
                        <span className="text-xs font-black uppercase">{p.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Lock size={14} /> Permissões de Acesso
                  </label>
                  <span className="text-[10px] text-brand-success font-bold uppercase bg-brand-success/10 px-2 py-1 rounded-lg border border-brand-success/20">
                    {(editFormData.permissions || []).length} Selecionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 bg-slate-950/30 rounded-xl border border-slate-800">
                  {[
                    { title: 'Dashboard', items: [PermissionModule.DASHBOARD] },
                    { title: 'Vendas PDV', items: [PermissionModule.SALES_PDV] },
                    { title: 'Financeiro', items: [PermissionModule.FINANCE_LIQUIDATE, PermissionModule.FINANCE_AUDIT, PermissionModule.FINANCE_EXTRACT] },
                    { title: 'Compras PDV', items: [PermissionModule.PURCHASES_PDV] },
                    { title: 'Cadastro', items: [PermissionModule.STOCK, PermissionModule.PARTNERS, PermissionModule.TEAMS, PermissionModule.BANKS, PermissionModule.FINANCE_CATEGORIES, PermissionModule.COMMERCIAL_TERMS] },
                    { title: 'Relatórios (Granular)', items: [PermissionModule.REPORTS_GENERAL, PermissionModule.REPORTS_RECEIVABLES, PermissionModule.REPORTS_PAYABLES, PermissionModule.REPORTS_STOCK, PermissionModule.REPORTS_PARTNERS, PermissionModule.REPORTS_AUDIT] },
                    { title: 'SaaS Master', items: [PermissionModule.SAAS_DASHBOARD, PermissionModule.SAAS_COMPANIES, PermissionModule.SAAS_PLANS, PermissionModule.INFRA_CLOUD] },
                    { title: 'Suporte', items: [PermissionModule.SUPPORT_HELP_CHANNELS, PermissionModule.SUPPORT_SECURITY_BACKUP] },
                  ].map(group => (
                    <div key={group.title} className="col-span-full space-y-2 mb-2">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1 border-b border-slate-800 pb-1">{group.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.items.map(perm => {
                          const isSelected = (editFormData.permissions || []).includes(perm);
                          return (
                            <label key={perm} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-slate-800 border-brand-success/50 text-white' : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => {
                                  const currentPerms = editFormData.permissions || [];
                                  if (isSelected) {
                                    setEditFormData({ ...editFormData, permissions: currentPerms.filter(p => p !== perm) });
                                  } else {
                                    setEditFormData({ ...editFormData, permissions: [...currentPerms, perm] });
                                  }
                                }}
                              />
                              <div className={`w-3 h-3 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-brand-success border-brand-success text-black' : 'border-slate-600'}`}>
                                {isSelected && <CheckCircle2 size={8} strokeWidth={4} />}
                              </div>
                              <span className="text-[9px] font-bold uppercase truncate leading-none" title={perm}>{perm.replace(/_/g, ' ')}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={14} /> Autorizações Remotas
                  </label>
                  <span className="text-[10px] text-brand-success font-bold uppercase bg-brand-success/10 px-2 py-1 rounded-lg border border-brand-success/20">
                    {(editFormData.remote_authorizations || []).length} Selecionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-950/30 rounded-xl border border-slate-800">
                  {[
                    {
                      title: 'PÁGINA DE CADASTRO',
                      subGroups: [
                        { title: 'Estoque', items: [{ key: RemoteAuthorization.AUTH_ESTOQUE_EDIT, label: 'Editar estoque' }, { key: RemoteAuthorization.AUTH_ESTOQUE_DELETE, label: 'Excluir estoque' }, { key: RemoteAuthorization.AUTH_ESTOQUE_ADJUST, label: 'Ajuste estoque Inventário' }] },
                        { title: 'Parceiros', items: [{ key: RemoteAuthorization.AUTH_PARTNERS_EDIT, label: 'Editar parceiros' }, { key: RemoteAuthorization.AUTH_PARTNERS_DELETE, label: 'Excluir parceiros' }] },
                        { title: 'Equipes', items: [{ key: RemoteAuthorization.AUTH_TEAMS_EDIT, label: 'Editar equipes' }, { key: RemoteAuthorization.AUTH_TEAMS_DELETE, label: 'Excluir equipes' }] },
                        { title: 'Instituição Bancária', items: [{ key: RemoteAuthorization.AUTH_BANKS_EDIT, label: 'Editar instituição' }, { key: RemoteAuthorization.AUTH_BANKS_DELETE, label: 'Excluir instituição' }] },
                        { title: 'Categorias', items: [{ key: RemoteAuthorization.AUTH_FINANCE_CATEGORY_EDIT, label: 'Editar categorias' }, { key: RemoteAuthorization.AUTH_FINANCE_CATEGORY_DELETE, label: 'Excluir categorias' }] },
                        { title: 'Formas Pagamentos', items: [{ key: RemoteAuthorization.AUTH_FINANCE_TERM_EDIT, label: 'Editar forma' }, { key: RemoteAuthorization.AUTH_FINANCE_TERM_DELETE, label: 'Excluir forma' }] }
                      ]
                    },
                    {
                      title: 'PÁGINA DE FINANCEIRO',
                      subGroups: [
                        { title: 'Liquidação de Títulos', items: [{ key: RemoteAuthorization.AUTH_FINANCE_TITLE_EDIT, label: 'Editar titulo' }, { key: RemoteAuthorization.AUTH_FINANCE_TITLE_DELETE, label: 'Excluir titulo' }, { key: RemoteAuthorization.AUTH_FINANCE_TITLE_REVERSE, label: 'Estornar titulo' }, { key: RemoteAuthorization.AUTH_FINANCE_CLOSE_CASHIER, label: 'Fechar caixa' }] },
                        { title: 'Auditoria de Turnos', items: [{ key: RemoteAuthorization.AUTH_FINANCE_AUDIT_REVERSE, label: 'Estornar turno' }] },
                        { title: 'Extrato Bancário', items: [{ key: RemoteAuthorization.AUTH_FINANCE_EXTRACT_MANUAL_OUT, label: 'Lançar Saída banco' }, { key: RemoteAuthorization.AUTH_FINANCE_EXTRACT_DELETE, label: 'Excluir lançamento' }, { key: RemoteAuthorization.AUTH_FINANCE_EXTRACT_EDIT, label: 'Editar lançamento' }] }
                      ]
                    },
                    {
                      title: 'PÁGINA DE COMPRA/VENDA',
                      subGroups: [
                        { title: 'Lançamento entrada/saida pdv', items: [{ key: RemoteAuthorization.AUTH_POS_MANUAL_IN, label: 'Lançamento Entrada' }, { key: RemoteAuthorization.AUTH_POS_MANUAL_OUT, label: 'Lançamento Saída' }] },
                        { title: 'Histórico pdv', items: [{ key: RemoteAuthorization.AUTH_POS_HISTORY_EDIT, label: 'Editar lançamento' }, { key: RemoteAuthorization.AUTH_POS_HISTORY_DELETE, label: 'Excluir lançamento' }, { key: RemoteAuthorization.AUTH_POS_HISTORY_REVERSE, label: 'Estornar lançamento' }, { key: RemoteAuthorization.AUTH_POS_CLOSE_CASHIER, label: 'Encerrar caixa' }] }
                      ]
                    },
                    {
                      title: 'PÁGINA DE SUPORTE & BACKUP',
                      subGroups: [{ title: 'Backup', items: [{ key: RemoteAuthorization.AUTH_BACKUP_RESTORE, label: 'Restaurar backup' }] }]
                    }
                  ].map(block => (
                    <div key={block.title} className="col-span-full space-y-4 mb-6">
                      <h3 className="text-xs font-black uppercase text-brand-success tracking-[0.2em] border-b-2 border-brand-success/20 pb-2">{block.title}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {block.subGroups.map(sub => (
                          <div key={sub.title} className="space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{sub.title}</h4>
                            <div className="space-y-1.5">
                              {sub.items.map(auth => {
                                const isSelected = (editFormData.remote_authorizations || []).includes(auth.key);
                                return (
                                  <label key={auth.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-slate-800 border-brand-success/50 text-white' : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={isSelected}
                                      onChange={() => {
                                        setEditFormData(prev => {
                                          const currentAuths = prev.remote_authorizations || [];
                                          const newAuths = isSelected
                                            ? currentAuths.filter(a => a !== auth.key)
                                            : [...currentAuths, auth.key];
                                          return { ...prev, remote_authorizations: newAuths };
                                        });
                                      }}
                                    />
                                    <div className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-brand-success border-brand-success text-black' : 'border-slate-600'}`}>
                                      {isSelected && <CheckCircle2 size={10} strokeWidth={4} />}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase truncate">{auth.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-brand-success text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl hover:scale-[1.02] transition-all">SOLICITAR LIBERAÇÃO EDIÇÃO</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONVITE */}
      {showInviteModal && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-slate-700">
            <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
              <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest">
                <Mail size={24} className="text-brand-success" /> Novo Convite
              </h2>
              <button onClick={() => setShowInviteModal(false)} className="p-2 text-slate-500 hover:text-white"><X size={32} /></button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              try {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                db.insert('invites', {
                  ...inviteForm,
                  code,
                  company_id: companyId,
                  status: 'pending',
                  created_by: currentUser?.id
                });
                alert(`Convite gerado com sucesso!\n\nCódigo de Acesso: ${code}\nEnviado para: ${inviteForm.email}`);
                setShowInviteModal(false);
                setInviteForm({ name: '', email: '', profile: OperationalProfile.VENDEDOR, permissions: [], remote_authorizations: [] });
                loadData();
              } catch (err) {
                alert('Erro ao gerar convite.');
              }
            }} className="p-8 pb-24 space-y-6" autoComplete="new-password">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="invite-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Colaborador</label>
                  <input
                    required
                    id="invite-name"
                    name="name"
                    autoComplete="name"
                    className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-brand-success transition-all"
                    value={inviteForm.name}
                    onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="invite-email" className="text-xs font-bold text-slate-500 uppercase tracking-widest">E-mail Corporativo</label>
                  <input
                    required
                    type="email"
                    id="invite-email"
                    name="email"
                    autoComplete="email"
                    className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-brand-success transition-all"
                    value={inviteForm.email}
                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="joao@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Perfil de Acesso</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: OperationalProfile.VENDEDOR, label: 'Vendedor', icon: Contact2 },
                    { id: OperationalProfile.COMPRADOR, label: 'Comprador', icon: ShoppingBag },
                    { id: OperationalProfile.FINANCEIRO, label: 'Financeiro', icon: BarChart3 },
                    { id: OperationalProfile.ESTOQUE, label: 'Estoque', icon: Package },
                    { id: OperationalProfile.GERENTE, label: 'Gerente', icon: ShieldCheckIcon },
                    { id: OperationalProfile.MASTER, label: 'Master', icon: Crown },
                  ].map(p => {
                    const isSelected = inviteProfiles.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          const newProfiles = isSelected
                            ? inviteProfiles.filter(x => x !== p.id)
                            : [...inviteProfiles, p.id];
                          setInviteProfiles(newProfiles);

                          const combinedPerms = getCombinedPermissions(newProfiles);
                          const combinedAuths = getCombinedAuthorizations(newProfiles);
                          setInviteForm({
                            ...inviteForm,
                            profile: newProfiles.join(', ') || 'Personalizado',
                            permissions: combinedPerms,
                            remote_authorizations: combinedAuths
                          });
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center ${isSelected ? 'bg-brand-success/10 border-brand-success text-brand-success' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                      >
                        <p.icon size={24} />
                        <span className="text-xs font-black uppercase">{p.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PERMISSIONS CHECKLIST */}
              <div className="space-y-4 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Lock size={14} /> Permissões de Acesso
                  </label>
                  <span className="text-[10px] text-brand-success font-bold uppercase bg-brand-success/10 px-2 py-1 rounded-lg border border-brand-success/20">
                    {inviteForm.permissions.length} Selecionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 bg-slate-950/30 rounded-xl border border-slate-800">
                  {[
                    { title: 'Dashboard', items: [PermissionModule.DASHBOARD] },
                    { title: 'Vendas PDV', items: [PermissionModule.SALES_PDV] },
                    { title: 'Financeiro', items: [PermissionModule.FINANCE_LIQUIDATE, PermissionModule.FINANCE_AUDIT, PermissionModule.FINANCE_EXTRACT] },
                    { title: 'Compras PDV', items: [PermissionModule.PURCHASES_PDV] },
                    { title: 'Cadastro', items: [PermissionModule.STOCK, PermissionModule.PARTNERS, PermissionModule.TEAMS, PermissionModule.BANKS, PermissionModule.FINANCE_CATEGORIES, PermissionModule.COMMERCIAL_TERMS] },
                    { title: 'Relatórios (Granular)', items: [PermissionModule.REPORTS_GENERAL, PermissionModule.REPORTS_RECEIVABLES, PermissionModule.REPORTS_PAYABLES, PermissionModule.REPORTS_STOCK, PermissionModule.REPORTS_PARTNERS, PermissionModule.REPORTS_AUDIT] },
                    { title: 'SaaS Master', items: [PermissionModule.SAAS_DASHBOARD, PermissionModule.SAAS_COMPANIES, PermissionModule.SAAS_PLANS, PermissionModule.INFRA_CLOUD] },
                    { title: 'Suporte', items: [PermissionModule.SUPPORT_HELP_CHANNELS, PermissionModule.SUPPORT_SECURITY_BACKUP] },
                  ].map(group => (
                    <div key={group.title} className="col-span-full space-y-2 mb-2">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1 border-b border-slate-800 pb-1">{group.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.items.map(perm => {
                          const isSelected = inviteForm.permissions.includes(perm);
                          return (
                            <label key={perm} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-slate-800 border-brand-success/50 text-white' : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setInviteForm(prev => ({ ...prev, permissions: prev.permissions.filter(p => p !== perm) }));
                                  } else {
                                    setInviteForm(prev => ({ ...prev, permissions: [...prev.permissions, perm] }));
                                  }
                                }}
                              />
                              <div className={`w-3 h-3 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-brand-success border-brand-success text-black' : 'border-slate-600'}`}>
                                {isSelected && <CheckCircle2 size={8} strokeWidth={4} />}
                              </div>
                              <span className="text-[9px] font-bold uppercase truncate leading-none" title={perm}>{perm.replace(/_/g, ' ')}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={14} /> Autorizações Remotas
                  </label>
                  <span className="text-[10px] text-brand-success font-bold uppercase bg-brand-success/10 px-2 py-1 rounded-lg border border-brand-success/20">
                    {inviteForm.remote_authorizations.length} Selecionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-950/30 rounded-xl border border-slate-800">
                  {[
                    {
                      title: 'PÁGINA DE CADASTRO',
                      subGroups: [
                        { title: 'Estoque', items: [{ key: RemoteAuthorization.AUTH_ESTOQUE_EDIT, label: 'Editar estoque' }, { key: RemoteAuthorization.AUTH_ESTOQUE_DELETE, label: 'Excluir estoque' }, { key: RemoteAuthorization.AUTH_ESTOQUE_ADJUST, label: 'Ajuste estoque Inventário' }] },
                        { title: 'Parceiros', items: [{ key: RemoteAuthorization.AUTH_PARTNERS_EDIT, label: 'Editar parceiros' }, { key: RemoteAuthorization.AUTH_PARTNERS_DELETE, label: 'Excluir parceiros' }] },
                        { title: 'Equipes', items: [{ key: RemoteAuthorization.AUTH_TEAMS_EDIT, label: 'Editar equipes' }, { key: RemoteAuthorization.AUTH_TEAMS_DELETE, label: 'Excluir equipes' }] },
                        { title: 'Instituição Bancária', items: [{ key: RemoteAuthorization.AUTH_BANKS_EDIT, label: 'Editar instituição' }, { key: RemoteAuthorization.AUTH_BANKS_DELETE, label: 'Excluir instituição' }] },
                        { title: 'Categorias', items: [{ key: RemoteAuthorization.AUTH_FINANCE_CATEGORY_EDIT, label: 'Editar categorias' }, { key: RemoteAuthorization.AUTH_FINANCE_CATEGORY_DELETE, label: 'Excluir categorias' }] },
                        { title: 'Formas Pagamentos', items: [{ key: RemoteAuthorization.AUTH_FINANCE_TERM_EDIT, label: 'Editar forma' }, { key: RemoteAuthorization.AUTH_FINANCE_TERM_DELETE, label: 'Excluir forma' }] }
                      ]
                    },
                    {
                      title: 'PÁGINA DE FINANCEIRO',
                      subGroups: [
                        { title: 'Liquidação de Títulos', items: [{ key: RemoteAuthorization.AUTH_FINANCE_TITLE_EDIT, label: 'Editar titulo' }, { key: RemoteAuthorization.AUTH_FINANCE_TITLE_DELETE, label: 'Excluir titulo' }, { key: RemoteAuthorization.AUTH_FINANCE_TITLE_REVERSE, label: 'Estornar titulo' }, { key: RemoteAuthorization.AUTH_FINANCE_CLOSE_CASHIER, label: 'Fechar caixa' }] },
                        { title: 'Auditoria de Turnos', items: [{ key: RemoteAuthorization.AUTH_FINANCE_AUDIT_REVERSE, label: 'Estornar turno' }] },
                        { title: 'Extrato Bancário', items: [{ key: RemoteAuthorization.AUTH_FINANCE_EXTRACT_MANUAL_OUT, label: 'Lançar Saída banco' }, { key: RemoteAuthorization.AUTH_FINANCE_EXTRACT_DELETE, label: 'Excluir lançamento' }, { key: RemoteAuthorization.AUTH_FINANCE_EXTRACT_EDIT, label: 'Editar lançamento' }] }
                      ]
                    },
                    {
                      title: 'PÁGINA DE COMPRA/VENDA',
                      subGroups: [
                        { title: 'Lançamento entrada/saida pdv', items: [{ key: RemoteAuthorization.AUTH_POS_MANUAL_IN, label: 'Lançamento Entrada' }, { key: RemoteAuthorization.AUTH_POS_MANUAL_OUT, label: 'Lançamento Saída' }] },
                        { title: 'Histórico pdv', items: [{ key: RemoteAuthorization.AUTH_POS_HISTORY_EDIT, label: 'Editar lançamento' }, { key: RemoteAuthorization.AUTH_POS_HISTORY_DELETE, label: 'Excluir lançamento' }, { key: RemoteAuthorization.AUTH_POS_HISTORY_REVERSE, label: 'Estornar lançamento' }, { key: RemoteAuthorization.AUTH_POS_CLOSE_CASHIER, label: 'Encerrar caixa' }] }
                      ]
                    },
                    {
                      title: 'PÁGINA DE SUPORTE & BACKUP',
                      subGroups: [{ title: 'Backup', items: [{ key: RemoteAuthorization.AUTH_BACKUP_RESTORE, label: 'Restaurar backup' }] }]
                    }
                  ].map(block => (
                    <div key={block.title} className="col-span-full space-y-4 mb-6">
                      <h3 className="text-xs font-black uppercase text-brand-success tracking-[0.2em] border-b-2 border-brand-success/20 pb-2">{block.title}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {block.subGroups.map(sub => (
                          <div key={sub.title} className="space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{sub.title}</h4>
                            <div className="space-y-1.5">
                              {sub.items.map(auth => {
                                const isSelected = inviteForm.remote_authorizations.includes(auth.key);
                                return (
                                  <label key={auth.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-slate-800 border-brand-success/50 text-white' : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={isSelected}
                                      onChange={() => {
                                        setInviteForm(prev => {
                                          const currentAuths = prev.remote_authorizations || [];
                                          const newAuths = isSelected
                                            ? currentAuths.filter(a => a !== auth.key)
                                            : [...currentAuths, auth.key];
                                          return { ...prev, remote_authorizations: newAuths };
                                        });
                                      }}
                                    />
                                    <div className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-brand-success border-brand-success text-black' : 'border-slate-600'}`}>
                                      {isSelected && <CheckCircle2 size={10} strokeWidth={4} />}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase truncate">{auth.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800">
                <button type="submit" className="w-full py-5 bg-brand-success text-white rounded-xl font-black uppercase text-sm tracking-[0.2em] shadow-lg shadow-brand-success/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                  <Link size={20} /> Gerar Link de Convite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONVITE ACIMA */}

      <RequestAuthorizationModal isOpen={isRequestAuthModalOpen} onClose={() => setIsRequestAuthModalOpen(false)} actionKey={authRequestData?.key || ''} actionLabel={authRequestData?.label || ''} />
    </div>
  );
};

export default Users;