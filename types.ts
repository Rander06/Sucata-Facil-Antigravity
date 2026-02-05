export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  STAFF = 'STAFF'
}

export enum OperationalProfile {
  VENDEDOR = 'Vendedor',
  COMPRADOR = 'Comprador',
  FINANCEIRO = 'Financeiro',
  ESTOQUE = 'Estoque',
  GERENTE = 'Gerente',
  MASTER = 'Master'
}

export enum PermissionModule {
  // DASHBOARD
  DASHBOARD = 'DASHBOARD OPERACIONAL',

  // VENDAS (PDV)
  SALES_PDV = 'VENDAS PDV',

  // FINANCEIRO
  FINANCE_LIQUIDATE = 'LIQUIDAÇÃO DE TÍTULOS',
  FINANCE_AUDIT = 'AUDITORIA DE TURNOS',
  FINANCE_EXTRACT = 'EXTRATO BANCÁRIOS',

  // COMPRAS
  PURCHASES_PDV = 'COMPRAS PDV',

  // ESTOQUE & CADASTROS
  STOCK = 'ESTOQUE',
  PARTNERS = 'PARCEIROS',
  TEAMS = 'EQUIPES',
  BANKS = 'INSTITUIÇÃO BANCÁRIAS',
  FINANCE_CATEGORIES = 'CATEGORIAS FINANCEIRAS',
  COMMERCIAL_TERMS = 'PRAZOS COMERCIAIS',

  // RELATORIOS
  REPORTS_VIEW = 'RELATORIOS_VISUALIZAR',
  REPORTS_GENERAL = 'RELATORIOS_EXTRATO_GERAL',
  REPORTS_RECEIVABLES = 'RELATORIOS_CONTAS_RECEBER',
  REPORTS_PAYABLES = 'RELATORIOS_CONTAS_PAGAR',
  REPORTS_STOCK = 'RELATORIOS_SALDO_ESTOQUE',
  REPORTS_PARTNERS = 'RELATORIOS_MOV_PARCEIROS',
  REPORTS_AUDIT = 'RELATORIOS_AUDITORIA_LOGS',

  // SUPORTE
  SUPPORT_VIEW = 'SUPORTE_VISUALIZAR',
  SUPPORT_HELP_CHANNELS = 'SUPORTE_CANAIS_AJUDA',
  SUPPORT_SECURITY_BACKUP = 'SUPORTE_SEGURANCA_BACKUP',

  // SAAS MASTER
  SAAS_DASHBOARD = 'DASHBOARD SAAS MASTER',
  SAAS_COMPANIES = 'GESTÃO DE EMPRESAS',
  SAAS_PLANS = 'GESTÃO DE PLANOS',
  INFRA_CLOUD = 'INFRAESTRUTURA CLOUD'
}

export enum RemoteAuthorization {
  // CADASTRO
  AUTH_ESTOQUE_EDIT = 'EDITAR_MATERIAL',
  AUTH_ESTOQUE_DELETE = 'EXCLUIR_MATERIAL',
  AUTH_ESTOQUE_ADJUST = 'AJUSTAR_ESTOQUE',
  AUTH_PARTNERS_EDIT = 'EDITAR_PARCEIRO',
  AUTH_PARTNERS_DELETE = 'EXCLUIR_PARCEIRO',
  AUTH_TEAMS_EDIT = 'EDITAR_EQUIPE',
  AUTH_TEAMS_DELETE = 'EXCLUIR_EQUIPE',
  AUTH_USER_EDIT = 'EDITAR_USUARIO',
  AUTH_USER_DELETE = 'EXCLUIR_USUARIO',
  AUTH_BANKS_EDIT = 'EDITAR_BANCO',
  AUTH_BANKS_DELETE = 'EXCLUIR_BANCO',
  AUTH_FINANCE_CATEGORY_EDIT = 'EDITAR_CATEGORIA_FINANCEIRA',
  AUTH_FINANCE_CATEGORY_DELETE = 'EXCLUIR_CATEGORIA_FINANCEIRA',
  AUTH_FINANCE_TERM_EDIT = 'EDITAR_PRAZO_COMERCIAL',
  AUTH_FINANCE_TERM_DELETE = 'EXCLUIR_PRAZO_COMERCIAL',

  // FINANCEIRO
  AUTH_FINANCE_TITLE_EDIT = 'SALVAR_EDICAO_FINANCEIRO',
  AUTH_FINANCE_TITLE_DELETE = 'EXCLUIR_LIQUIDACAO',
  AUTH_FINANCE_TITLE_REVERSE = 'ESTORNAR_LIQUIDACAO',
  AUTH_FINANCE_AUDIT_REVERSE = 'ESTORNAR_AUDITORIA',
  AUTH_FINANCE_EXTRACT_MANUAL_OUT = 'LANCAMENTO_MANUAL_CARTEIRA',
  AUTH_FINANCE_EXTRACT_DELETE = 'CANCELAR_TRANSACAO_CARTEIRA',
  AUTH_FINANCE_EXTRACT_EDIT = 'EDITAR_TRANSACAO_CARTEIRA',
  AUTH_FINANCE_CLOSE_CASHIER = 'FECHAR_CAIXA_FINANCEIRO',

  // COMPRA/VENDA
  AUTH_POS_MANUAL_IN = 'LANCAMENTO_MANUAL',
  AUTH_POS_MANUAL_OUT = 'LANCAMENTO_MANUAL_OUT',
  AUTH_POS_HISTORY_EDIT = 'EDITAR_LANCAMENTO',
  AUTH_POS_HISTORY_DELETE = 'CANCELAR_LANCAMENTO',
  AUTH_POS_HISTORY_REVERSE = 'ESTORNAR_LANCAMENTO',
  AUTH_POS_CLOSE_CASHIER = 'FECHAR_CAIXA',

  // SUPORTE & BACKUP
  AUTH_BACKUP_RESTORE = 'RESTAURAR_BACKUP'
}

export interface User {
  id: string;
  user_id?: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  profile: OperationalProfile;
  companyId: string | null;
  company_id?: string | null;
  permissions: PermissionModule[];
  remote_authorizations?: RemoteAuthorization[];
  createdAt: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_login?: string;
  last_logout?: string;
}

export interface AuthorizationRequest {
  id: string;
  company_id: string;
  action_key: string;
  action_label: string;
  action_payload?: string; // Payload JSON opcional
  requested_by_id: string;
  requested_by_name: string;
  protocol_id: string; // REQ-XXXXX
  approval_code?: string; // APR-YYYYY
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'PROCESSED';
  created_at: string;
  responded_at?: string;
  responded_by_id?: string;
  responded_by_name?: string;
}

export interface Bank {
  id: string;
  companyId: string | null;
  company_id?: string | null;
  userId?: string | null;
  user_id?: string | null;
  name: string;
  code?: string;
  agency?: string;
  account?: string;
  status?: string;
  isDefault?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Backup {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  filename: string;
  data: any;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  planId: string;
  plan_id?: string;
  status: 'active' | 'blocked' | 'trial';
  expiresAt: string;
  expires_at?: string;
  createdAt: string;
  created_at?: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  maxUsers: number;
  max_users?: number;
  modules: PermissionModule[];
  billing_cycle?: 'monthly' | 'yearly';
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Material {
  id: string;
  companyId: string;
  company_id?: string;
  name: string;
  unit: 'KG' | 'UN';
  stock: number;
  minStock: number;
  min_stock?: number;
  maxStock: number;
  max_stock?: number;
  buyPrice: number;
  buy_price?: number;
  sellPrice: number;
  sell_price?: number;
  created_at?: string;
}

export interface Partner {
  id: string;
  companyId: string;
  company_id?: string;
  name: string;
  type: 'supplier' | 'customer' | 'both';
  document: string;
  phone: string;
  created_at?: string;
}

export interface PaymentTerm {
  id: string;
  uuid?: string;
  companyId: string | null;
  company_id?: string | null;
  name: string;
  days: number;
  installments: number;
  type: 'fixed' | 'installments';
  showInSale?: boolean;
  show_in_sale?: boolean;
  showInPurchase?: boolean;
  show_in_purchase?: boolean;
  showInSettle?: boolean;
  show_in_settle?: boolean;
  showInBankManual?: boolean;
  show_in_bank_manual?: boolean;
  showInPdvManual?: boolean;
  show_in_pdv_manual?: boolean;
  show_in_manual_pdv?: boolean;
  showInCashierClose?: boolean;
  show_in_cashier_close?: boolean;
  showInOpening?: boolean;
  show_in_opening?: boolean;
  showInTitleLaunch?: boolean;
  show_in_title_launch?: boolean;
  isDefault?: boolean;
  is_default?: boolean;
  createdAt: string;
  created_at?: string;
}

export interface FinanceCategory {
  id: string;
  companyId: string | null;
  company_id?: string | null;
  name: string;
  type: 'in' | 'out' | 'both';
  isDefault?: boolean;
  is_default?: boolean;
  showInSales?: boolean;
  showInPurchases?: boolean;
  showInLiquidation?: boolean;
  show_in_sales?: boolean;
  show_in_purchases?: boolean;
  show_in_liquidation?: boolean;
  show_in_bank_manual?: boolean; // Contexto Financeiro
  show_in_pdv_manual?: boolean;  // Contexto PDV
  show_in_title_launch?: boolean; // Contexto Lançamento Títulos
  created_at?: string;
}

export interface FinancialRecord {
  id: string;
  companyId: string | null;
  company_id?: string | null;
  tipo: 'pagamento' | 'despesa' | 'vendas' | 'compras' | 'sangria' | 'entrada' | 'suprimento';
  natureza?: 'ENTRADA' | 'SAIDA';
  categoria: string;
  valor: number;
  status: 'pending' | 'paid' | 'overdue' | 'reversed';
  description: string;
  dueDate: string | null;
  due_date?: string | null;
  parceiro_id?: string;
  transaction_id?: string;
  caixa_id?: string;
  paymentTermId?: string;
  payment_term_id?: string;
  walletEntry?: number;
  wallet_entry?: number;
  walletExit?: number;
  wallet_exit?: number;
  isReconciled?: boolean;
  is_reconciled?: boolean;
  usuario_id?: string;
  userId?: string;
  user_id?: string;
  isReversed?: boolean;
  is_reversed?: boolean;
  changeValue?: number;
  change_value?: number;
  paymentMethod?: string;
  payment_method?: string;
  forma_pagamento?: string;
  created_at: string;
  liquidation_date?: string;
}

export interface WalletTransaction {
  id: string;
  company_id: string;
  user_id?: string;
  categoria: string;
  parceiro: string;
  forma?: string; // Tornada opcional para evitar erro no Supabase
  payment_term_id?: string;
  descricao: string;
  valor_entrada: number;
  valor_saida: number;
  saldo_real: number;
  status?: string;
  operador_id?: string;
  operador_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  company_id: string;
  user_id: string;
  valor: number;
  status: 'completed' | 'canceled';
  natureza: 'ENTRADA' | 'SAIDA';
  items: TransactionItem[];
  created_at: string;
}

export interface TransactionItem {
  id: string;
  materialId: string;
  material_id?: string;
  materialName: string;
  material_name?: string;
  quantity: number;
  price: number;
  total: number;
  unit: string;
}

export interface CartItem {
  id: string;
  material: Material;
  quantity: number;
  unit: 'KG' | 'UN';
  systemPrice: number;
  appliedPrice: number;
}

export interface CashierSession {
  id: string;
  companyId: string | null;
  company_id?: string | null;
  userId: string;
  user_id?: string;
  userName: string;
  user_name?: string;
  type: 'pos' | 'finance';
  status: 'open' | 'closed' | 'reconciled';
  openingBalance: number;
  opening_balance?: number;
  closingBalance?: number;
  closing_balance?: number;
  expectedBalance?: number;
  expected_balance?: number;
  reconciledBalance?: number;
  reconciled_balance?: number;
  difference?: number;
  openingTime: string;
  opening_time?: string;
  closingTime?: string;
  closing_time?: string;
  reconciledAt?: string;
  reconciled_at?: string;
  reconciledById?: string;
  reconciled_by_id?: string;
  reconciledByName?: string;
  reconciled_by_name?: string;
  physicalBreakdown?: Record<string, number>;
  physical_breakdown?: Record<string, number>;
  reconciledBreakdown?: Record<string, number> | null;
  reconciled_breakdown?: Record<string, number> | null;
  created_at?: string;
}

export interface ActionLog {
  id: string;
  companyId: string | null;
  company_id?: string | null;
  userId: string;
  user_id?: string;
  userName: string;
  user_name?: string;
  action: string;
  details: string;
  timestamp?: string;
  created_at: string;
}