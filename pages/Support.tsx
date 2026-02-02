import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { ActionLog, UserRole, Backup, PermissionModule } from '../types';
import {
  LifeBuoy,
  MessageSquare,
  Mail,
  Download,
  Upload,
  FileJson,
  Clock,
  Calendar,
  User as UserIcon,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Database,
  Search,
  Lock,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Cloud,
  RefreshCw,
  Save
} from 'lucide-react';

const Support: React.FC = () => {
  const { currentUser, isCloudEnabled } = useAppContext();
  const companyId = currentUser?.companyId || currentUser?.company_id || null;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const [activeModal, setActiveModal] = useState<'support' | 'backup' | null>(null);
  const [cloudBackups, setCloudBackups] = useState<Backup[]>([]);
  const [alertModal, setAlertModal] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isCloudEnabled) {
      loadCloudBackups();
    }
  }, [companyId, activeModal, isCloudEnabled]);

  const loadCloudBackups = async () => {
    try {
      const data = await db.getCloudBackups(companyId);
      setCloudBackups(data);
    } catch (err) {
      console.error("Erro cloud:", err);
    }
  };

  const handleBackupLocal = () => {
    const data = db.get();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sucata-facil-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    db.logAction(companyId, currentUser!.id, currentUser!.name, 'BACKUP_EXPORT', `OP: Backup Manual | CTX: Segurança | DET: Usuário executou exportação local da base | VAL: R$ 0,00`);
    setAlertModal({ msg: "Backup exportado com sucesso!", type: 'success' });
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8 max-w-full overflow-x-hidden">
      <header className="px-1">
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-white uppercase tracking-tight">
          <LifeBuoy className="text-brand-success" />
          Suporte & Segurança
        </h1>
        <p className="text-slate-400 text-sm mt-1">Central de ajuda e proteção de dados cloud.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
        {[
          { id: 'support', label: 'Canais de Ajuda', icon: MessageSquare, color: 'green', permission: PermissionModule.SUPPORT_HELP_CHANNELS },
          { id: 'backup', label: 'Segurança & Backup', icon: Database, color: 'blue', permission: PermissionModule.SUPPORT_SECURITY_BACKUP }
        ]
          .filter(item =>
            currentUser?.permissions.includes(item.permission) ||
            currentUser?.role === UserRole.SUPER_ADMIN ||
            currentUser?.role === UserRole.COMPANY_ADMIN ||
            currentUser?.email === 'admin@sucatafacil.com'
          )
          .map(item => (
            <button key={item.id} onClick={() => setActiveModal(item.id as any)} className="enterprise-card p-8 flex items-center gap-6 transition-all group bg-slate-900/40 border-t-4 border-t-slate-800 hover:border-t-brand-success">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-brand-success group-hover:bg-brand-success/10 transition-colors"><item.icon size={32} /></div>
              <div className="flex-1 text-left"><h3 className="text-white font-black uppercase text-base tracking-widest">{item.label}</h3></div>
              <ChevronRight className="text-slate-700 group-hover:text-white transition-all group-hover:translate-x-1" size={24} />
            </button>
          ))}
      </div>

      {activeModal === 'backup' && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in">
          <header className="bg-brand-card border-b border-slate-800 p-4 flex items-center justify-between shadow-2xl">
            <h2 className="text-lg font-black text-white uppercase tracking-widest ml-4 flex items-center gap-3"><Database className="text-blue-500" /> Segurança de Dados</h2>
            <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl px-4 mr-4 flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest">Fechar</span><X size={20} /></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="enterprise-card p-8 space-y-6">
                  <h3 className="text-white font-black uppercase text-sm tracking-widest">Backup Offline</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">Gere um arquivo JSON contendo todos os dados locais desta unidade para armazenamento físico de segurança.</p>
                  <button onClick={handleBackupLocal} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-3 hover:bg-slate-700 transition-all"><Download size={18} /> Exportar Base Local</button>
                </div>
                <div className="enterprise-card p-8 space-y-6">
                  <h3 className="text-white font-black uppercase text-sm tracking-widest">Proteção Cloud</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">Snapshot periódico da base de dados em cluster criptografado no Supabase para recuperação rápida.</p>
                  <div className="flex items-center gap-3 p-4 bg-brand-success/5 border border-brand-success/20 rounded-xl">
                    <Cloud size={20} className="text-brand-success" />
                    <span className="text-[10px] font-black text-brand-success uppercase">Monitoramento Cloud Ativo</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {activeModal === 'support' && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-brand-dark animate-in fade-in">
          <header className="bg-brand-card border-b border-slate-800 p-4 flex items-center justify-between shadow-2xl">
            <h2 className="text-lg font-black text-white uppercase tracking-widest ml-4 flex items-center gap-3"><MessageSquare className="text-brand-success" /> Suporte Técnico</h2>
            <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl px-4 mr-4 flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest">Fechar</span><X size={20} /></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-8 py-12 text-center">
              <div className="w-24 h-24 bg-brand-success/10 rounded-full flex items-center justify-center mx-auto border-2 border-brand-success/20 text-brand-success mb-6"><LifeBuoy size={48} /></div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Central de Atendimento</h3>
              <p className="text-slate-400 leading-relaxed">Nossa equipe de engenharia está disponível para auxiliar na configuração da sua infraestrutura Cloud e suporte operacional v3.0.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8">
                <a href="https://wa.me/5500000000000" target="_blank" rel="noreferrer" className="enterprise-card p-6 flex flex-col items-center gap-4 hover:border-brand-success transition-all bg-slate-900/50">
                  <div className="p-3 bg-brand-success/10 text-brand-success rounded-xl"><MessageSquare size={24} /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp Business</span>
                </a>
                <a href="mailto:suporte@sucatafacil.com" className="enterprise-card p-6 flex flex-col items-center gap-4 hover:border-brand-success transition-all bg-slate-900/50">
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><Mail size={24} /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">E-mail Corporativo</span>
                </a>
              </div>
            </div>
          </main>
        </div>
      )}

      {alertModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4 animate-in fade-in">
          <div className="enterprise-card w-full max-w-sm p-8 text-center space-y-4 border-slate-700">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2 ${alertModal.type === 'success' ? 'border-brand-success/30 bg-brand-success/5 text-brand-success' : 'border-brand-error/30 bg-brand-error/5 text-brand-error'}`}>{alertModal.type === 'success' ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}</div>
            <p className="text-white font-bold text-sm uppercase leading-relaxed">{alertModal.msg}</p>
            <button onClick={() => setAlertModal(null)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;