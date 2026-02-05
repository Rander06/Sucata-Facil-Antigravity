import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Chaves padrão (fallback)
export const SUPABASE_URL = 'https://masmjnulixoafvbxfnwn.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_v7biWGR7sNCZZ9bLiFkN3w_226sqsFr';

let singletonClient: SupabaseClient | null = null;

export const getSupabaseConfig = () => {
  // Busca configuração dinâmica salva
  const savedConfigRaw = localStorage.getItem('sucata_facil_cloud_config');
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

export const createVerificationClient = () => {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

export const createSupabaseClient = (url?: string, key?: string) => {
  // Se for solicitado um novo cliente com chaves específicas, recriamos (usado no CloudConfig)
  if (url && key) {
    singletonClient = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return singletonClient;
  }

  // Se já existir um cliente instanciado, retorna o mesmo para evitar "Multiple GoTrueClient instances"
  if (singletonClient) return singletonClient;

  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    singletonClient = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    return singletonClient;
  } catch (e) {
    return null;
  }
};