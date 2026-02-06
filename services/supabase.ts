import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Chaves padrão (fallback)
export const SUPABASE_URL = 'https://masmjnulixoafvbxfnwn.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_v7biWGR7sNCZZ9bLiFkN3w_226sqsFr';

let singletonClient: SupabaseClient | null = null;
let singletonVerificationClient: SupabaseClient | null = null;

export const getSupabaseConfig = () => {
  // Busca configuração dinâmica salva
  const savedConfigRaw = localStorage.getItem('sucata_fail_cloud_config');
  let dynamicUrl = null;
  let dynamicKey = null;

  if (savedConfigRaw) {
    try {
      const parsed = JSON.parse(savedConfigRaw);
      dynamicUrl = parsed.url;
      dynamicKey = parsed.key;
    } catch (e) { }
  }

  const finalUrl = dynamicUrl || SUPABASE_URL;
  const finalKey = dynamicKey || SUPABASE_ANON_KEY;

  if (!finalUrl || !finalKey || finalUrl.includes('your-project')) return null;

  return { url: finalUrl, key: finalKey };
};

/**
 * Cliente específico para verificação de credenciais master/gestor.
 * Usa chave de armazenamento única para evitar aviso de "Multiple GoTrueClient instances".
 */
export const createVerificationClient = () => {
  if (singletonVerificationClient) return singletonVerificationClient;

  const config = getSupabaseConfig();
  if (!config) return null;

  singletonVerificationClient = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false, // Critical to avoid "Multiple GoTrueClient" warning
      storageKey: 'sf-verify-auth'
    }
  });
  return singletonVerificationClient;
};

/**
 * Cliente principal da aplicação.
 * Usa singleton e chave de armazenamento dedicada.
 */
export const createSupabaseClient = (url?: string, key?: string) => {
  // Se for solicitado um novo cliente com chaves específicas (ex: CloudConfig)
  if (url && key) {
    singletonClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'sf-main-auth'
      }
    });
    return singletonClient;
  }

  // Retorna instância existente para evitar avisos e instabilidade
  if (singletonClient) return singletonClient;

  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    singletonClient = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'sf-main-auth'
      }
    });
    return singletonClient;
  } catch (e) {
    return null;
  }
};