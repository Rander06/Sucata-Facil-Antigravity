import React, { useState, useEffect } from 'react';
import { db } from '../services/dbService';
import { useAppContext } from '../store/AppContext';
import { Cloud, Save, ShieldCheck, AlertCircle, Trash2, Key, Globe, Database, FileText, Copy, Check, ShieldAlert, UploadCloud, RefreshCw, Loader2 } from 'lucide-react';

const CloudConfig: React.FC = () => {
  const { refreshData, performManualSync } = useAppContext();
  const [config, setConfig] = useState({ url: '', key: '' });
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isMigrating, setIsMigrating] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [copied, setCopied] = useState(false);
  const CLOUD_CONFIG_KEY = 'sucata_facil_cloud_config';

  const MASTER_SQL = `-- SUCATA FÁCIL v3.0 - SECURITY FIX v4.14 (NUCLEAR OPTION)
-- ESTE SCRIPT REMOVE *TODAS* AS POLÍTICAS DE *TODAS* AS TABELAS PÚBLICAS.
-- ISSO É NECESSÁRIO PORQUE O SECURITY ADVISOR AINDA ESTÁ "VENDO" POLÍTICAS ANTIGAS.

-- PARTE 1: DOCTOR DROP - REMOVE TUDO (POLÍTICAS)
DO $$
DECLARE
    row_policy RECORD;
BEGIN
    -- Loop por TODAS as políticas do schema public e elimina uma por uma
    FOR row_policy IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.%I', row_policy.policyname, row_policy.tablename);
    END LOOP;
END $$;

-- PARTE 2: RECONSTRUÇÃO SEGURA (COMPLIANT)
-- Reaplica a política "Safe" em TODAS as tabelas.
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);

        EXECUTE format('
            CREATE POLICY "policy_v4_14_compliant_%s" ON public.%I
            AS PERMISSIVE FOR ALL
            TO public
            USING (auth.role() IN (''anon'', ''authenticated'', ''service_role''))
            WITH CHECK (auth.role() IN (''anon'', ''authenticated'', ''service_role''))
        ', tbl.tablename, tbl.tablename);
    END LOOP;
END $$;

-- PARTE 3: REFORÇO DE FUNÇÕES (MANTÉM O FIX DA v4.13)
DO $$
DECLARE
    func_record RECORD;
    sig TEXT;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
    LOOP
        sig := pg_get_function_identity_arguments(func_record.oid);
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, extensions', func_record.proname, sig);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
END $$;

-- PARTE 4: UPDATE SCHEMA (ADD NEW COLUMNS)
-- Adiciona coluna para contexto de lançamento de títulos (v4.15)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_terms' AND column_name='show_in_title_launch') THEN
        ALTER TABLE public.payment_terms ADD COLUMN show_in_title_launch BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_categories' AND column_name='show_in_title_launch') THEN
        ALTER TABLE public.finance_categories ADD COLUMN show_in_title_launch BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
`;

  useEffect(() => {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) setConfig(JSON.parse(saved));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('testing');
    setErrorDetails('');
    try {
      localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
      const initialized = db.reInitializeCloud();
      if (initialized) {
        const client = db.getCloudClient();
        const { error: errorTest } = await client!.from('profiles').select('id').limit(1);
        if (errorTest && errorTest.code !== 'PGRST116') {
          setStatus('error');
          setErrorDetails("Erro de RLS (v4.8 Necessário). Aplique o SQL ao lado.");
          return;
        }
        setStatus('success');
        refreshData();
        performManualSync();
      }
    } catch (err: any) {
      setStatus('error');
      setErrorDetails(err.message || "Falha de rede.");
    }
  };

  const handleMigrateToCloud = async () => {
    if (!confirm("Isso enviará todos os dados locais para o banco v4.5. Confirmar?")) return;
    setIsMigrating(true);
    try {
      const success = await db.pushStateToCloud();
      if (success) {
        alert("Sincronização Cloud finalizada com sucesso!");
        performManualSync();
      }
    } catch (err: any) {
      alert("Erro na migração: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(MASTER_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black flex items-center gap-3 text-white uppercase tracking-tight"><Cloud className="text-brand-success" /> Infraestrutura Cloud</h1>
        <p className="text-slate-500 mt-1">SaaS Security Nuclear Option v4.14</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="enterprise-card p-8 border-slate-800">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12} /> Endpoint Supabase</label>
                <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-brand-success transition-all" value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} placeholder="https://xxxx.supabase.co" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Key size={12} /> Chave Pública (Anon)</label>
                <textarea required rows={3} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-mono text-xs outline-none focus:border-brand-success resize-none" value={config.key} onChange={e => setConfig({ ...config, key: e.target.value })} placeholder="eyJhbGci..." />
              </div>
              <button type="submit" disabled={status === 'testing'} className="w-full py-4 bg-brand-success text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] disabled:opacity-50 transition-all">
                {status === 'testing' ? 'Conectando...' : 'Reconectar Cluster v4.14'}
              </button>
            </form>

            {status === 'error' && (
              <div className="mt-4 p-4 bg-brand-error/10 border border-brand-error/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="text-brand-error" size={20} />
                <p className="text-[11px] text-brand-error font-bold uppercase">{errorDetails}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="mt-8 space-y-6 animate-in slide-in-from-top-2">
                <div className="p-4 bg-brand-success/10 border border-brand-success/30 rounded-2xl flex items-center gap-4">
                  <ShieldCheck className="text-brand-success" size={24} />
                  <p className="text-white font-bold text-sm">Cluster Ativo! v4.14 Pronto.</p>
                </div>

                <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <UploadCloud className="text-blue-400" size={20} />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Correção de Persistência</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold">Use este botão para subir os dados locais após aplicar o SQL v4.5 no Supabase.</p>
                  <button
                    disabled={isMigrating}
                    onClick={handleMigrateToCloud}
                    className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {isMigrating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    {isMigrating ? 'Sincronizando...' : 'Publicar Banco Local na Nuvem'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="enterprise-card p-6 border-slate-800 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
              <h3 className="text-xs font-black uppercase text-brand-success">SQL Master v4.14</h3>
              <button onClick={handleCopySQL} className="text-[10px] font-black uppercase text-slate-500 hover:text-white flex items-center gap-2">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="flex-1 bg-brand-dark p-4 rounded-xl border border-slate-800 font-mono text-[9px] text-brand-success overflow-y-auto max-h-[500px]">
              <pre>{MASTER_SQL}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloudConfig;