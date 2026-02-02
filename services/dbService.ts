import { PermissionModule, UserRole, OperationalProfile, User, ActionLog, PaymentTerm, FinanceCategory, CashierSession, FinancialRecord, Backup, WalletTransaction, Bank, AuthorizationRequest } from '../types';
import { createSupabaseClient } from './supabase';

const STORAGE_KEY = 'sucata_facil_db';

interface DBState {
  users: any[];
  companies: any[];
  plans: any[];
  materials: any[];
  partners: any[];
  financials: any[];
  transactions: any[];
  logs: any[];
  cashierSessions: any[];
  invites: any[];
  paymentTerms: PaymentTerm[];
  financeCategories: FinanceCategory[];
  walletTransactions: WalletTransaction[];
  banks: Bank[];
  authorization_requests: AuthorizationRequest[];
}

let supabaseInstance: any = null;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Returns current timestamp in UTC (ISO 8601 format)
// This is what Supabase expects for TIMESTAMPTZ columns
const getBrNow = () => {
  return new Date().toISOString();
};

const TABLE_MAP: Record<string, string> = {
  users: 'profiles',
  profiles: 'profiles',
  companies: 'companies',
  plans: 'plans',
  materials: 'materials',
  partners: 'partners',
  financials: 'financials',
  transactions: 'transactions',
  logs: 'logs',
  cashierSessions: 'cashier_sessions',
  invites: 'invites',
  paymentTerms: 'payment_terms',
  financeCategories: 'finance_categories',
  finance_categories: 'finance_categories',
  payment_terms: 'payment_terms',
  backups: 'backups',
  walletTransactions: 'wallet_transactions',
  banks: 'banks',
  authorization_requests: 'authorization_requests'
};

const NOMENCLATURE_MAP: Record<string, string> = {
  companyId: 'company_id',
  id_companies: 'company_id',
  userName: 'user_name',
  planId: 'plan_id',
  natureza: 'natureza',
  expiresAt: 'expires_at',
  createdAt: 'created_at',
  timestamp: 'created_at',
  updatedAt: 'updated_at',
  updated_at: 'updated_at',
  createdBy: 'created_by',
  updatedBy: 'updated_by',
  maxUsers: 'max_users',
  minStock: 'min_stock',
  maxStock: 'max_stock',
  buyPrice: 'buy_price',
  sellPrice: 'sell_price',
  showInSale: 'show_in_sale',
  showInPurchase: 'show_in_purchase',
  showInSettle: 'show_in_settle',
  showInBankManual: 'show_in_bank_manual',
  showInPdvManual: 'show_in_pdv_manual',
  showInManualPdv: 'show_in_manual_pdv',
  showInCashierClose: 'show_in_cashier_close',
  showInOpening: 'show_in_opening',
  showInSales: 'show_in_sales',
  showInPurchases: 'show_in_purchases',
  showInLiquidation: 'show_in_liquidation',
  isDefault: 'is_default',
  dueDate: 'due_date',
  liquidationDate: 'liquidation_date',
  paymentTermId: 'payment_term_id',
  walletEntry: 'wallet_entry',
  walletExit: 'wallet_exit',
  isReconciled: 'is_reconciled',
  isReversed: 'is_reversed',
  changeValue: 'change_value',
  paymentMethod: 'payment_method',
  materialId: 'material_id',
  materialName: 'material_name',
  openingBalance: 'opening_balance',
  closingBalance: 'closing_balance',
  expectedBalance: 'expected_balance',
  reconciledBalance: 'auditoria_corrigida',
  openingTime: 'opening_time',
  closingTime: 'closing_time',
  reconciledAt: 'reconciled_at',
  reconciledById: 'reconciled_by_id',
  reconciledByName: 'reconciled_by_name',
  physicalBreakdown: 'physical_breakdown',
  reconciledBreakdown: 'reconciled_breakdown',
  parceiroId: 'parceiro_id',
  transactionId: 'transaction_id',
  caixaId: 'caixa_id',
  userId: 'user_id',
  usuario_id: 'user_id',
  difference: 'difference',
  requestedById: 'requested_by_id',
  requestedByName: 'requested_by_name',
  protocolId: 'protocol_id',
  approvalCode: 'approval_code',
  respondedAt: 'responded_at',
  respondedById: 'responded_by_id',
  respondedByName: 'responded_by_name',
  actionKey: 'action_key',
  actionLabel: 'action_label',
  actionPayload: 'action_payload',
  amount: 'valor'
};

const TABLE_COLUMNS: Record<string, string[]> = {
  users: ['id', 'email', 'name', 'role', 'profile', 'company_id', 'permissions', 'created_at'],
  profiles: ['id', 'email', 'name', 'role', 'profile', 'company_id', 'permissions', 'created_at'],
  financials: ['id', 'company_id', 'user_id', 'tipo', 'natureza', 'categoria', 'valor', 'status', 'description', 'due_date', 'parceiro_id', 'transaction_id', 'caixa_id', 'payment_term_id', 'liquidation_date', 'forma_pagamento', 'created_at', 'updated_at'],
  transactions: ['id', 'company_id', 'user_id', 'valor', 'status', 'natureza', 'tipo', 'items', 'created_at'],
  materials: ['id', 'company_id', 'name', 'unit', 'stock', 'min_stock', 'max_stock', 'buy_price', 'sell_price', 'created_at', 'updated_at'],
  cashierSessions: ['id', 'company_id', 'user_id', 'user_name', 'type', 'status', 'opening_balance', 'closing_balance', 'expected_balance', 'auditoria_corrigida', 'difference', 'opening_time', 'closing_time', 'reconciled_at', 'reconciled_by_id', 'reconciled_by_name', 'physical_breakdown', 'reconciled_breakdown', 'created_at', 'updated_at'],
  walletTransactions: ['id', 'company_id', 'user_id', 'id_original', 'categoria', 'parceiro', 'payment_term_id', 'descricao', 'valor_entrada', 'valor_saida', 'saldo_real', 'status', 'operador_id', 'operador_name', 'created_at', 'updated_at'],
  partners: ['id', 'company_id', 'name', 'type', 'document', 'phone', 'created_at'],
  paymentTerms: ['id', 'uuid', 'company_id', 'user_id', 'name', 'days', 'installments', 'type', 'show_in_sale', 'show_in_purchase', 'show_in_settle', 'show_in_bank_manual', 'show_in_pdv_manual', 'show_in_manual_pdv', 'show_in_cashier_close', 'show_in_opening', 'is_default', 'created_at', 'updated_at'],
  financeCategories: ['id', 'company_id', 'user_id', 'name', 'type', 'is_default', 'show_in_sales', 'show_in_purchases', 'show_in_liquidation', 'show_in_bank_manual', 'show_in_pdv_manual', 'created_at', 'updated_at'],
  banks: ['id', 'company_id', 'user_id', 'name', 'code', 'agency', 'account', 'status', 'is_default', 'created_at', 'updated_at'],
  logs: ['id', 'company_id', 'user_id', 'user_name', 'action', 'details', 'created_at'],
  invites: ['id', 'company_id', 'user_id', 'code', 'name', 'email', 'profile', 'permissions', 'status', 'created_by', 'created_at', 'updated_at'],
  companies: ['id', 'name', 'cnpj', 'plan_id', 'status', 'expires_at', 'created_at'],
  plans: ['id', 'name', 'price', 'max_users', 'modules', 'billing_cycle', 'is_active', 'created_at'],
  authorization_requests: ['id', 'company_id', 'action_key', 'action_label', 'action_payload', 'requested_by_id', 'requested_by_name', 'protocol_id', 'approval_code', 'status', 'created_at', 'responded_at', 'responded_by_id', 'responded_by_name']
};

const applyRedundancy = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = { ...obj };

  const cid = newObj.company_id || newObj.companyId || newObj.id_companies;
  if (cid) {
    const cidStr = String(cid).trim();
    newObj.company_id = cidStr;
    newObj.companyId = cidStr;
    newObj.id_companies = cidStr;
  }

  if (newObj.plan_id && !newObj.planId) newObj.planId = newObj.plan_id;
  if (newObj.planId && !newObj.plan_id) newObj.plan_id = newObj.planId;
  if (newObj.expires_at && !newObj.expiresAt) newObj.expiresAt = newObj.expires_at;
  if (newObj.expiresAt && !newObj.expires_at) newObj.expires_at = newObj.expiresAt;

  Object.entries(NOMENCLATURE_MAP).forEach(([camel, snake]) => {
    if (newObj[camel] !== undefined && newObj[snake] === undefined) {
      newObj[snake] = newObj[camel];
    } else if (newObj[snake] !== undefined && newObj[camel] === undefined) {
      newObj[camel] = newObj[snake];
    }
  });

  return newObj;
};

const prepareForCloud = (obj: any, tableKey: string) => {
  if (!obj || typeof obj !== 'object') return obj;

  // BYPASS: Para 'users', enviamos o objeto filtrado pela whitelist (TABLE_COLUMNS) 
  // para evitar erro de coluna inexistente (ex: camelCase) mas permitir arrays
  if (['users', 'profiles'].includes(tableKey)) {
    const clean: any = {};
    const validCols = TABLE_COLUMNS[tableKey] || [];
    validCols.forEach(k => {
      if (obj[k] !== undefined) clean[k] = obj[k];
    });
    return clean;
  }

  const cloudObj: any = {};
  const source = applyRedundancy(obj);
  const allowedColumns = TABLE_COLUMNS[tableKey] || [];

  const parseNum = (val: any) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const numericFields = ['opening_balance', 'closing_balance', 'expected_balance', 'auditoria_corrigida', 'difference', 'valor', 'valor_entrada', 'valor_saida', 'saldo_real', 'stock', 'buy_price', 'sell_price', 'price', 'max_users'];

  allowedColumns.forEach(col => {
    if (source[col] !== undefined) {
      if (['id', 'payment_term_id', 'requested_by_id', 'responded_by_id', 'user_id', 'company_id', 'plan_id', 'caixa_id', 'transaction_id', 'parceiro_id'].includes(col)) {
        cloudObj[col] = (source[col] === '' || source[col] === 'null' || source[col] === null) ? null : String(source[col]);
      } else if (numericFields.includes(col)) {
        cloudObj[col] = parseNum(source[col]);
      } else {
        cloudObj[col] = source[col];
      }
    }
  });

  return cloudObj;
};

export const db = {
  getNowISO: getBrNow,
  getToday: () => getBrNow().split('T')[0],
  normalize: applyRedundancy,

  getCloudClient: () => {
    if (!supabaseInstance) supabaseInstance = createSupabaseClient();
    return supabaseInstance;
  },

  reInitializeCloud: () => {
    supabaseInstance = createSupabaseClient();
    return !!supabaseInstance;
  },

  syncFromCloud: async () => {
    if (localStorage.getItem('sf_restore_lock') === 'true') return true;
    const client = db.getCloudClient();
    if (!client) return false;
    try {
      const currentState = db.get();
      const syncTables = ['materials', 'partners', 'financials', 'transactions', 'cashierSessions', 'walletTransactions', 'banks', 'logs', 'invites', 'companies', 'plans', 'users', 'paymentTerms', 'financeCategories', 'authorization_requests'];

      const { data: { session } } = await client.auth.getSession();

      for (const tableKey of syncTables) {
        const cloudTable = TABLE_MAP[tableKey];
        if (!cloudTable) continue;

        const { data, error } = await client.from(cloudTable).select('*');
        if (!error && data) {
          const normalized = data.map(applyRedundancy);
          (currentState as any)[tableKey] = normalized;
        }
      }
      db.save(currentState);
      return true;
    } catch (err) {
      return false;
    }
  },

  pushStateToCloud: async () => {
    const client = db.getCloudClient();
    if (!client) return false;
    const state = db.get();
    const tablesToPush = ['materials', 'partners', 'paymentTerms', 'financeCategories', 'financials', 'transactions', 'cashierSessions', 'walletTransactions', 'banks', 'logs', 'invites', 'plans', 'authorization_requests', 'users', 'companies'];

    let allSuccess = true;
    for (const tableKey of tablesToPush) {
      const items = (state as any)[tableKey] || [];
      if (items.length === 0) continue;
      const cloudTable = TABLE_MAP[tableKey];
      if (!cloudTable) continue;

      const payloads = items.map((it: any) => prepareForCloud(it, tableKey));
      const { error } = await client.from(cloudTable).upsert(payloads, { onConflict: 'id' });

      if (error) {
        console.error(`[CLOUD_SYNC_ERROR] Tabela ${cloudTable}:`, error);
        allSuccess = false;
      }
    }
    return allSuccess;
  },

  get: (): DBState => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : getInitialState();
  },

  save: (state: DBState) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)),

  restoreState: async (newState: DBState) => {
    db.save(newState);
    localStorage.setItem('sf_restore_lock', 'true');
    await new Promise(r => setTimeout(r, 100));
    return true;
  },

  query: <T>(table: keyof DBState, filter?: (item: T) => boolean): T[] => {
    const rawItems = (db.get()[table] || []) as unknown as any[];
    const normalizedItems = rawItems.map(applyRedundancy);
    return filter ? normalizedItems.filter(filter) : normalizedItems;
  },

  queryTenant: <T>(table: keyof DBState, companyId: string | null, filter?: (item: T) => boolean): T[] => {
    const rawItems = (db.get()[table] || []) as unknown as any[];
    const normalizedItems = rawItems.map(applyRedundancy);
    const targetCid = String(companyId || '').trim();

    return normalizedItems.filter(item => {
      const itemCid = String(item.company_id || item.companyId || '').trim();
      if (!targetCid || targetCid === 'null' || targetCid === 'undefined' || targetCid === '') {
        return filter ? filter(item as unknown as T) : true;
      }
      const match = itemCid === targetCid;
      return filter ? (match && filter(item as unknown as T)) : match;
    });
  },

  verifyCredentials: (email: string, password: string, requiredPermission?: PermissionModule): User | null => {
    const ADMIN_EMAIL = 'admin@sucatafacil.com';
    const ADMIN_PASS = 'Mr748197/';

    if (email.toLowerCase().trim() === ADMIN_EMAIL && password.trim() === ADMIN_PASS) {
      const allUsers = db.get().users;
      const master = allUsers.find(u => u.email.toLowerCase().trim() === ADMIN_EMAIL);

      const masterObj = applyRedundancy({
        ...(master || { id: 'admin-1', name: 'Super Admin', email: ADMIN_EMAIL }),
        role: UserRole.SUPER_ADMIN,
        profile: OperationalProfile.MASTER,
        company_id: '1b8967ab-fb43-452d-8061-afc03bd3e15e',
        permissions: Object.values(PermissionModule)
      });
      return masterObj as User;
    }

    const user = db.get().users.find(u => u.email === email && u.password === password);
    if (!user) return null;
    if (requiredPermission && !user.permissions.includes(requiredPermission)) return null;
    return applyRedundancy(user);
  },

  insert: async <T>(table: keyof DBState, item: any): Promise<T> => {
    const data = db.get();
    const userStr = localStorage.getItem('auth_user');
    let cid = null, uid = null;
    if (userStr) {
      const u = JSON.parse(userStr);
      cid = u.company_id || u.companyId;
      uid = u.id;
    }
    const targetCid = item.company_id || item.companyId || cid;

    const newItemRaw = {
      ...item,
      id: item.id || generateId(),
      company_id: targetCid ? String(targetCid) : null,
      user_id: item.user_id || item.userId || item.usuario_id || uid || null,
      created_at: item.created_at || getBrNow(),
      updated_at: getBrNow()
    };
    const newItem = applyRedundancy(newItemRaw);

    if (!data[table]) (data as any)[table] = [];
    (data as any)[table].push(newItem);
    db.save(data);

    const client = db.getCloudClient();
    if (client) {
      const cloudTable = TABLE_MAP[table as string];
      if (cloudTable) {
        const payload = prepareForCloud(newItem, table as string);
        console.log(`[DB_INSERT] Salvando em ${cloudTable}:`, payload);
        const { error } = await client.from(cloudTable).insert(payload);
        if (error) {
          console.error(`[CLOUD_INSERT_ERROR] Tabela: ${cloudTable} | Payload:`, payload, "| Erro:", error);
          if (error.code === '42501') {
            alert(`Sua permissão no Supabase bloqueou este salvamento. Vá em 'Infraestrutura Cloud' e aplique o SQL v4.8.`);
          } else if (error.code === 'PGRST204') {
            alert(`Erro de Esquema: A coluna informada não existe na nuvem. Clique em 'Configurações Cloud' e selecione 'Sincronizar Estrutura'.`);
          } else {
            alert(`Erro ao salvar na nuvem: ${error.message} (Código: ${error.code})`);
          }
        } else {
          console.log(`[DB_INSERT] ✅ Salvo com sucesso em ${cloudTable}`);
        }
      }
    }
    return newItem;
  },

  update: async <T>(table: keyof DBState, id: string, updates: any): Promise<T> => {
    const data = db.get();
    const index = (data[table] as any[]).findIndex(item => item.id === id);
    if (index === -1) throw new Error(`Item ${id} not found`);

    const normalizedUpdates = applyRedundancy(updates);
    data[table][index] = applyRedundancy({ ...data[table][index], ...normalizedUpdates, updated_at: getBrNow() });

    db.save(data);
    const client = db.getCloudClient();
    if (client) {
      const cloudTable = TABLE_MAP[table as string];
      if (cloudTable) {
        const payload = prepareForCloud(data[table][index], table as string);
        const { error } = await client.from(cloudTable).update(payload).eq('id', id);
        if (error) {
          console.error(`[CLOUD_UPDATE_ERROR] Tabela: ${cloudTable} | Erro:`, error);
          if (error.code === 'PGRST204') {
            alert(`Erro de Esquema: A coluna informada não existe na nuvem. Vá em 'Configurações Cloud' e execute o SQL de Atualização.`);
          }
        }
      }
    }
    return data[table][index];
  },

  delete: async (table: keyof DBState, id: string) => {
    // 1. Snapshot do estado atual para rollback (opcional, mas seguro)
    const previousState = db.get();

    // 2. Delete Otimista Local
    const data = db.get();
    data[table] = (data[table] as any[]).filter(item => item.id !== id);
    db.save(data);

    // 3. Sincronização Cloud
    const client = db.getCloudClient();
    if (client) {
      const cloudTable = TABLE_MAP[table as string];
      if (cloudTable) {
        // Usa select() no delete para retornar os dados excluídos e verificar count
        const { error, count } = await client.from(cloudTable).delete({ count: 'exact' }).eq('id', id);

        if (error) {
          console.error(`[CLOUD_DELETE_ERROR] Tabela: ${cloudTable} | Erro:`, error);
          db.save(previousState); // Rollback
          throw new Error(error.message || 'Erro ao excluir na nuvem');
        }

        // Se nenhum registro foi afetado, pode ser silêncio do RLS ou ID não encontrado
        if (count === 0) {
          console.warn(`[CLOUD_DELETE_WARN] Exclusão retornou 0 linhas. Verifique RLS ou ID.`);
          // Opcional: Rollback se considerar falha
          // db.save(previousState);
          // throw new Error('Nenhum registro foi excluído. Verifique permissões/existência.');
        }
      }
    }
  },

  logAction: async (companyId: string | null, userId: string, userName: string, action: string, details: string) => {
    await db.insert('logs', { company_id: companyId ? String(companyId) : null, user_id: userId || null, user_name: userName, action, details });
  },

  saveCloudSnapshot: async (companyId: string | null, userId: string, userName: string) => {
    const client = db.getCloudClient();
    if (!client) return { error: 'Cloud não configurada.' };
    try {
      const data = db.get();
      const filename = `backup-${companyId?.slice(0, 5)}-${new Date().toISOString().split('T')[0]}.json`;
      const { error } = await client.from('backups').insert({ company_id: companyId ? String(companyId) : null, user_id: userId, user_name: userName, filename, data });
      if (error) return { error: error.message };
      return { success: true };
    } catch (err: any) { return { error: err.message }; }
  },

  getCloudBackups: async (companyId: string | null) => {
    const client = db.getCloudClient();
    if (!client) return [];
    const { data } = await client.from('backups').select('*').eq('company_id', String(companyId)).order('created_at', { ascending: false }).limit(10);
    return data || [];
  },

  calculateExpectedValue: (companyId: string | null, session: CashierSession, itemId: string, _paymentTerms: PaymentTerm[], financeCategories: FinanceCategory[], flowType: 'ENTRADA' | 'SAIDA'): number => {
    const allPaymentTerms = db.queryTenant<PaymentTerm>('paymentTerms', companyId, () => true);
    const records = db.queryTenant<FinancialRecord>('financials', companyId, f => f.caixa_id === session.id);

    const isPhysicalCash = ['vista', 'physical_cash', '00000000-0000-0000-0000-000000000001'].includes(itemId);
    const isPhysicalCheck = ['cheque', 'physical_check', '00000000-0000-0000-0000-000000000003'].includes(itemId);

    if (isPhysicalCash) {
      let total = session.openingBalance || session.opening_balance || 0;
      records.forEach(r => {
        if (r.categoria === 'Abertura de Caixa' || r.isReversed || r.status === 'reversed') return;
        const isEntry = ['vendas', 'suprimento', 'entrada', 'pagamento', 'sell'].includes(String(r.tipo).toLowerCase());
        const termId = r.paymentTermId || r.payment_term_id;
        const term = allPaymentTerms.find(t => t.id === termId || t.uuid === termId);
        const isDinheiro = (term && term.name.toUpperCase().includes('DINHEIRO')) || (!termId && !term);
        if (isDinheiro) {
          if (isEntry) { if (r.status === 'paid') total += r.valor; } else { total -= r.valor; }
        }
      });
      return total;
    }

    let total = 0;
    const categoryObj = financeCategories.find(c => c.id === itemId);
    const catName = categoryObj?.name;
    records.forEach(r => {
      if (r.categoria === 'Abertura de Caixa' || r.isReversed || r.status === 'reversed') return;
      const isEntry = ['vendas', 'suprimento', 'entrada', 'pagamento', 'sell'].includes(String(r.tipo).toLowerCase());
      const termId = r.paymentTermId || r.payment_term_id;
      const term = allPaymentTerms.find(t => t.id === termId || t.uuid === termId);
      const isCheque = (term && term.name.toUpperCase().includes('CHEQUE'));
      let match = isPhysicalCheck ? isCheque : ((termId === itemId || (term && term.uuid === itemId)) || (catName && r.categoria === catName));
      if (match) {
        if (flowType === 'ENTRADA' && isEntry) total += r.valor;
        else if (flowType === 'SAIDA' && !isEntry) total += r.valor;
      }
    });
    return total;
  }
};

const getInitialState = (): DBState => {
  const now = getBrNow();
  return {
    users: [applyRedundancy({ id: 'admin-1', email: 'admin@sucatafacil.com', password: 'Mr748197/', name: 'Super Admin', role: UserRole.SUPER_ADMIN, profile: OperationalProfile.MASTER, company_id: '1b8967ab-fb43-452d-8061-afc03bd3e15e', permissions: Object.values(PermissionModule), createdAt: now })],
    companies: [],
    plans: [],
    materials: [], partners: [], financials: [], transactions: [], logs: [], cashierSessions: [], invites: [],
    paymentTerms: [],
    financeCategories: [],
    walletTransactions: [],
    banks: [],
    authorization_requests: []
  };
};