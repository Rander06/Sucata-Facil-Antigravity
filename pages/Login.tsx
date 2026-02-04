import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { db } from '../services/dbService';
import { User, UserRole, Company, Plan, OperationalProfile, PermissionModule } from '../types';
import { Shield, Lock, Mail, Package, Building2, User as UserIcon, Phone, FileText, CheckCircle2, ChevronRight, ChevronLeft, Gift, X, Link, Cloud, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { setCurrentUser, isCloudEnabled, isSyncing } = useAppContext();
  const [mode, setMode] = useState<'login' | 'register' | 'invite'>('login');

  const [email, setEmail] = useState('admin@sucatafacil.com');
  const [password, setPassword] = useState('Mr748197/');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);

  const [regForm, setRegForm] = useState({
    companyName: '',
    ownerName: '',
    email: '',
    whatsapp: '',
    document: '',
    password: '',
    confirmPassword: '',
    planId: ''
  });

  const [inviteRegForm, setInviteRegForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);

  // Carregar planos disponíveis
  useEffect(() => {
    const loadPlans = async () => {
      const client = db.getCloudClient();
      if (client) {
        console.log('🔍 Carregando planos do Supabase...');
        const { data, error } = await client.from('plans').select('*').order('price');

        if (error) {
          console.error('❌ Erro ao carregar planos:', error);
          setError(`Erro ao carregar planos: ${error.message}`);
        } else {
          console.log('✅ Planos carregados:', data);
          if (data) setAvailablePlans(data);
        }
      } else {
        console.warn('⚠️ Cliente Supabase não disponível');
      }
    };
    if (mode === 'register') {
      loadPlans();
    }
  }, [mode]);

  // Função para validar CPF
  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleaned.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleaned.charAt(10))) return false;

    return true;
  };

  // Função para validar CNPJ
  const validateCNPJ = (cnpj: string): boolean => {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false;

    let length = cleaned.length - 2;
    let numbers = cleaned.substring(0, length);
    const digits = cleaned.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
  };

  // Função para validar telefone/WhatsApp
  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const client = db.getCloudClient();

      if (client) {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim()
        });

        if (authError) throw new Error(authError.message);

        if (authData.user) {
          let profile = null;
          // Loop de retry para aguardar a trigger do banco criar o perfil
          for (let i = 0; i < 5; i++) {
            const { data } = await client.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
            if (data && data.permissions && data.permissions.length > 0) {
              profile = data;
              break;
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          if (profile) {
            setCurrentUser(db.normalize(profile));
            return;
          }

          if (email.trim().toLowerCase() === 'admin@sucatafacil.com') {
            const masterProfile = {
              id: authData.user.id,
              email: email.trim().toLowerCase(),
              name: 'Super Admin',
              role: UserRole.SUPER_ADMIN,
              profile: OperationalProfile.MASTER,
              company_id: '1b8967ab-fb43-452d-8061-afc03bd3e15e',
              permissions: Object.values(PermissionModule)
            };
            const { data: newP, error: upsertErr } = await client.from('profiles').upsert(masterProfile).select().single();
            if (upsertErr) throw new Error("Erro ao estabelecer perfil mestre: " + upsertErr.message);
            setCurrentUser(db.normalize(newP));
            return;
          }

          throw new Error('Perfil operacional incompleto ou permissões não localizadas. Entre em contato com o suporte.');
        }
      }

      const localUser = db.query<User>('users', u => u.email === email)[0];
      if (localUser && localUser.password === password) {
        setCurrentUser(localUser);
      } else {
        setError('Credenciais incorretas ou servidor Cloud fora de alcance.');
      }
    } catch (err: any) {
      setError(err.message || 'Falha crítica na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    // Validar CPF ou CNPJ
    const docCleaned = regForm.document.replace(/\D/g, '');
    if (docCleaned.length === 11) {
      if (!validateCPF(regForm.document)) {
        setError("CPF inválido. Verifique o número digitado.");
        return;
      }
    } else if (docCleaned.length === 14) {
      if (!validateCNPJ(regForm.document)) {
        setError("CNPJ inválido. Verifique o número digitado.");
        return;
      }
    } else {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    // Validar telefone/WhatsApp
    if (!validatePhone(regForm.whatsapp)) {
      setError("Telefone/WhatsApp inválido. Informe um número com DDD (mínimo 10 dígitos).");
      return;
    }

    setLoading(true);

    let createdCompanyId = null;

    try {
      const client = db.getCloudClient();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const expiresStr = expiresAt.toISOString().split('T')[0];

      if (client) {
        // FLUXO CLOUD ENTERPRISE v38.9

        const { data: existingProfile } = await client.from('profiles').select('id').eq('email', regForm.email.trim().toLowerCase()).maybeSingle();
        if (existingProfile) {
          setError("Este e-mail já está registrado em nosso sistema. Faça login para continuar.");
          setLoading(false);
          return;
        }

        const { data: planData } = await client.from('plans').select('*').eq('id', regForm.planId).single();
        if (!planData) throw new Error("O plano selecionado não foi localizado no cluster.");

        const { data: company, error: compErr } = await client.from('companies').insert({
          name: regForm.companyName.toUpperCase(),
          cnpj: regForm.document,
          whatsapp: regForm.whatsapp,
          plan_id: regForm.planId,
          status: 'trial',
          expires_at: expiresStr
        }).select().single();

        if (compErr) throw new Error(`Falha ao registrar empresa: ${compErr.message}`);

        createdCompanyId = company.id;

        const { error: limitErr } = await client.from('company_plan_limits').insert({
          company_id: company.id,
          plan_id: regForm.planId,
          max_users: planData.max_users || 1,
          active_modules: planData.modules || []
        });

        const { data: auth, error: authErr } = await client.auth.signUp({
          email: regForm.email.trim().toLowerCase(),
          password: regForm.password,
          options: {
            data: {
              name: regForm.ownerName.toUpperCase(),
              company_id: company.id,
              is_owner: 'true' // Tag para trigger forçar permissões master
            }
          }
        });

        if (authErr) {
          if (createdCompanyId) await client.from('companies').delete().eq('id', createdCompanyId);
          if (authErr.message.includes('already registered')) {
            setError("Usuário já registrado! Use outro e-mail ou faça login.");
          } else {
            throw new Error(`Erro na autenticação: ${authErr.message}`);
          }
          return;
        }

        if (auth.user) {
          // Espera a trigger v38.9 processar (Maior tempo para garantir permissões)
          await new Promise(r => setTimeout(r, 4000));
          const { data: profile } = await client.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();

          if (profile && profile.permissions && profile.permissions.length > 0) {
            setCurrentUser(db.normalize(profile));
          } else {
            setError("Unidade registrada com sucesso! Por favor, realize o login para ativar seus módulos.");
            setMode('login');
          }
        }
      } else {
        const newCompany = await db.insert<Company>('companies', {
          name: regForm.companyName, cnpj: regForm.document, planId: regForm.planId, status: 'trial', expiresAt: expiresStr,
        });
        const newUser = await db.insert<User>('users', {
          name: regForm.ownerName, email: regForm.email, password: regForm.password, role: UserRole.COMPANY_ADMIN, profile: OperationalProfile.MASTER, companyId: newCompany.id, permissions: Object.values(PermissionModule).filter(p => !p.toString().includes('SAAS_'))
        });
        setCurrentUser(newUser);
      }
    } catch (err: any) {
      const client = db.getCloudClient();
      if (client && createdCompanyId) await client.from('companies').delete().eq('id', createdCompanyId);
      setError(err.message || 'Erro inesperado ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const client = db.getCloudClient();
      if (client) {
        const { data, error } = await client.from('invites').select('*').eq('code', inviteCode.toUpperCase()).eq('status', 'pending').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Código de convite inválido ou já utilizado.");
        setInviteData(data);
      } else {
        const localInvite = db.query<any>('invites', i => i.code === inviteCode.toUpperCase() && i.status === 'pending')[0];
        if (!localInvite) throw new Error("Código de convite inválido ou já utilizado.");
        setInviteData(localInvite);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (inviteRegForm.password !== inviteRegForm.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);

    try {
      if (!inviteData) throw new Error("Dados do convite não carregados.");
      const client = db.getCloudClient();

      if (client) {
        // FLUXO CLOUD ACTIVATION
        const { data: auth, error: authErr } = await client.auth.signUp({
          email: inviteData.email,
          password: inviteRegForm.password,
          options: {
            data: {
              name: inviteData.name,
              company_id: inviteData.company_id,
              profile: inviteData.profile,
              permissions: inviteData.permissions, // Passando as permissões definidas no convite
              invite_id: inviteData.id
            }
          }
        });

        if (authErr) throw authErr;

        // Atualiza status do convite
        await client.from('invites').update({ status: 'accepted' }).eq('id', inviteData.id);

        if (auth.user) {
          // Aguarda trigger criar perfil
          await new Promise(r => setTimeout(r, 4000));
          const { data: profile } = await client.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
          if (profile) {
            setCurrentUser(db.normalize(profile));
          } else {
            setError("Cadastro concluído! Faça login para entrar.");
            setMode('login');
          }
        }
      } else {
        // FLUXO LOCAL
        const newUser = await db.insert<User>('users', {
          name: inviteData.name,
          email: inviteData.email,
          password: inviteRegForm.password,
          role: UserRole.STAFF,
          profile: inviteData.profile as OperationalProfile,
          companyId: inviteData.company_id,
          permissions: [] // Triggered by profile in real app, here empty for now
        });
        db.update('invites', inviteData.id, { status: 'accepted' });
        setCurrentUser(newUser);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {mode === 'login' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="w-16 h-16 bg-brand-success rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] mb-6">
                <Package className="text-white" size={32} />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight mb-2">Sucata Fácil <span className="text-brand-success">Enterprise</span></h1>
              <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest">SaaS Cloud Infrastructure</p>
            </div>

            <div className="enterprise-card p-8 border-slate-800 shadow-2xl">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-slate-400">Identificador de Acesso</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input id="email" name="email" type="email" autoComplete="username" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-400">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                </div>
                {error && (
                  <div className="p-4 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} className="text-brand-error shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] text-brand-error font-black uppercase leading-tight">{error}</p>
                      {error.includes('registrado') && (
                        <button onClick={() => setMode('login')} className="text-[10px] text-white font-bold underline mt-1 uppercase">Ir para Login agora</button>
                      )}
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || isSyncing}
                  className="w-full bg-brand-success text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-brand-success/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Acessar Terminal Cloud'}
                </button>
              </form>
              <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col gap-4 text-center">
                <p className="text-sm text-slate-500 font-medium">Não possui cadastro? <button onClick={() => setMode('register')} className="text-brand-success font-black hover:underline transition-all">Registrar Unidade</button></p>
                <p className="text-sm text-slate-500 font-medium pt-2 border-t border-slate-800/30">Recebeu um convite? <button onClick={() => setMode('invite')} className="text-white font-black hover:underline transition-all uppercase text-[10px] tracking-widest border border-slate-700 px-4 py-2 rounded-lg mt-2">Ativar Convite de Equipe</button></p>
              </div>
            </div>
          </div>
        ) : mode === 'register' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full">
            <div className="enterprise-card overflow-hidden shadow-2xl border-slate-800">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Registro de Unidade</h2>
                  <p className="text-slate-400 text-sm">Cluster Enterprise SaaS</p>
                </div>
                <Shield className="text-brand-success" size={32} />
              </div>
              <form onSubmit={handleRegister} className="p-8 space-y-6">
                {error && (
                  <div className="p-4 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} className="text-brand-error shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] text-brand-error font-black uppercase leading-tight">{error}</p>
                      <button type="button" onClick={() => setMode('login')} className="text-[10px] text-white font-bold underline mt-1 uppercase">Clique aqui para Fazer Login</button>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="reg-ownerName" className="text-sm font-semibold text-slate-400">Nome do Proprietário</label>
                    <input id="reg-ownerName" name="ownerName" type="text" autoComplete="name" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium uppercase" value={regForm.ownerName} onChange={(e) => setRegForm({ ...regForm, ownerName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reg-email" className="text-sm font-semibold text-slate-400">E-mail Gestor</label>
                    <input id="reg-email" name="email" type="email" autoComplete="email" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="reg-document" className="text-sm font-semibold text-slate-400">CPF ou CNPJ</label>
                      <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          id="reg-document"
                          name="document"
                          type="text"
                          required
                          autoComplete="off"
                          placeholder="000.000.000-00"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium font-mono"
                          value={regForm.document}
                          onChange={(e) => setRegForm({ ...regForm, document: e.target.value })}
                        />
                      </div>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wide">11 dígitos (CPF) ou 14 (CNPJ)</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="reg-whatsapp" className="text-sm font-semibold text-slate-400">WhatsApp / Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          id="reg-whatsapp"
                          name="whatsapp"
                          type="tel"
                          required
                          autoComplete="tel"
                          placeholder="(00) 00000-0000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium font-mono"
                          value={regForm.whatsapp}
                          onChange={(e) => setRegForm({ ...regForm, whatsapp: e.target.value })}
                        />
                      </div>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wide">Com DDD (10-11 dígitos)</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reg-companyName" className="text-sm font-semibold text-slate-400">Nome Fantasia da Empresa</label>
                    <input id="reg-companyName" name="companyName" type="text" autoComplete="organization" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium uppercase" value={regForm.companyName} onChange={(e) => setRegForm({ ...regForm, companyName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reg-planId" className="text-sm font-semibold text-slate-400">Plano de Assinatura</label>
                    <select
                      id="reg-planId"
                      name="planId"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium uppercase appearance-none cursor-pointer"
                      value={regForm.planId}
                      onChange={(e) => setRegForm({ ...regForm, planId: e.target.value })}
                    >
                      <option value="" disabled>Selecione um plano</option>
                      {availablePlans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} - R$ {plan.price?.toFixed(2)} ({plan.max_users} usuário{plan.max_users > 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                    {regForm.planId && availablePlans.find(p => p.id === regForm.planId) && (
                      <div className="p-3 bg-brand-success/5 border border-brand-success/20 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          {availablePlans.find(p => p.id === regForm.planId)?.description}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="reg-password" className="text-sm font-semibold text-slate-400">Senha</label>
                      <input id="reg-password" name="password" type="password" autoComplete="new-password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="reg-confirmPassword" className="text-sm font-semibold text-slate-400">Confirmação</label>
                      <input id="reg-confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={regForm.confirmPassword} onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <button type="submit" disabled={loading} className="w-full bg-brand-success text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-brand-success/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'CONCLUIR CADASTRO CLOUD'}
                  </button>
                  <button type="button" onClick={() => setMode('login')} className="w-full text-slate-500 font-bold py-2 hover:text-white transition-colors uppercase text-[10px] tracking-widest">Voltar para Login</button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full text-white">
            <div className="enterprise-card overflow-hidden shadow-2xl border-slate-800">
              <div className="p-8 border-b border-slate-800 flex items-center justify-center">
                <div>
                  <h2 className="text-2xl font-bold">Ativar Convite</h2>
                  <p className="text-slate-400 text-sm">Integração de Novo Colaborador</p>
                </div>
                <Link className="text-brand-success ml-4" size={32} />
              </div>

              {!inviteData ? (
                <form onSubmit={handleValidateInvite} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="inv-code" className="text-sm font-semibold text-slate-400 uppercase tracking-widest text-[10px]">Código de Acesso de 6 Dígitos</label>
                    <input
                      id="inv-code"
                      name="inviteCode"
                      required
                      autoComplete="off"
                      maxLength={6}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-5 px-4 text-white text-center text-3xl font-black outline-none focus:ring-2 focus:ring-brand-success transition-all uppercase tracking-[0.3em] font-mono"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXX"
                    />
                  </div>
                  {error && (
                    <div className="p-4 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-center gap-3">
                      <AlertCircle size={20} className="text-brand-error shrink-0" />
                      <p className="text-[11px] text-brand-error font-black uppercase leading-tight">{error}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <button type="submit" disabled={loading} className="w-full bg-brand-success text-white font-black uppercase tracking-widest py-5 rounded-xl shadow-lg shadow-brand-success/20 transition-all flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : 'VALIDAR CONVITE'}
                    </button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-slate-500 font-bold py-2 hover:text-white transition-colors uppercase text-[10px] tracking-widest">Cancelar e Voltar</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleActivateInvite} className="p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="p-4 bg-brand-success/5 border border-brand-success/10 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-success/20 flex items-center justify-center text-brand-success text-xl font-bold">
                      {inviteData.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-black uppercase text-sm">{inviteData.name}</p>
                      <p className="text-slate-500 text-xs">{inviteData.email}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="inv-password" className="text-sm font-semibold text-slate-400">Defina uma Senha de Acesso</label>
                      <input id="inv-password" name="password" type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={inviteRegForm.password} onChange={(e) => setInviteRegForm({ ...inviteRegForm, password: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="inv-confirmPassword" className="text-sm font-semibold text-slate-400">Confirme a Senha</label>
                      <input id="inv-confirmPassword" name="confirmPassword" type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 text-white outline-none focus:ring-1 focus:ring-brand-success transition-all font-medium" value={inviteRegForm.confirmPassword} onChange={(e) => setInviteRegForm({ ...inviteRegForm, confirmPassword: e.target.value })} />
                    </div>
                  </div>
                  {error && (
                    <div className="p-4 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-center gap-3">
                      <AlertCircle size={20} className="text-brand-error shrink-0" />
                      <p className="text-[11px] text-brand-error font-black uppercase leading-tight">{error}</p>
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="w-full bg-brand-success text-white font-black uppercase tracking-widest py-5 rounded-xl shadow-lg shadow-brand-success/20 transition-all flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'ATIVAR MINHA CONTA AGORA'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;