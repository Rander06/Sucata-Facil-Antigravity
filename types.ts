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

  // FINANCEIRO
  FINANCE_VIEW = 'FINANCEIRO_VISUALIZAR',
  FINANCE_CREATE = 'FINANCEIRO_CRIAR',
  FINANCE_EDIT = 'FINANCEIRO_EDITAR',
  FINANCE_DELETE = 'FINANCEIRO_EXCLUIR',
  FINANCE_LIQUIDATE = 'FINANCEIRO_LIQUIDAR',
  FINANCE_EXTRACT = 'FINANCEIRO_EXTRATO',
  FINANCE_AUDIT = 'FINANCEIRO_AUDITORIA_TURNOS',

  // COMPRAS
  PURCHASES_VIEW = 'COMPRAS_VISUALIZAR',
  PURCHASES_CREATE = 'COMPRAS_CRIAR',
  PURCHASES_EDIT = 'COMPRAS_EDITAR',
  PURCHASES_DELETE = 'COMPRAS_EXCLUIR',

  // VENDAS (PDV)
  SALES_VIEW = 'VENDAS_VISUALIZAR',
  SALES_CREATE = 'VENDAS_CRIAR',
  SALES_CLOSE_CASHIER = 'VENDAS_FECHAR_CAIXA',

  // ESTOQUE
  STOCK_VIEW = 'ESTOQUE_VISUALIZAR',
  STOCK_CREATE = 'ESTOQUE_CRIAR',
  STOCK_EDIT = 'ESTOQUE_EDITAR',
  STOCK_DELETE = 'ESTOQUE_EXCLUIR',
  STOCK_ADJUST = 'ESTOQUE_AJUSTE_RAPIDO',

  // PARCEIROS
  PARTNERS_VIEW = 'PARCEIROS_VISUALIZAR',
  PARTNERS_CREATE = 'PARCEIROS_CRIAR',
  PARTNERS_EDIT = 'PARCEIROS_EDITAR',
  PARTNERS_DELETE = 'PARCEIROS_EXCLUIR',

  // RELATORIOS
  // RELATORIOS
  REPORTS_VIEW = 'RELATORIOS_VISUALIZAR',
  REPORTS_GENERAL = 'RELATORIOS_EXTRATO_GERAL',
  REPORTS_RECEIVABLES = 'RELATORIOS_CONTAS_RECEBER',
  REPORTS_PAYABLES = 'RELATORIOS_CONTAS_PAGAR',
  REPORTS_STOCK = 'RELATORIOS_SALDO_ESTOQUE',
  REPORTS_PARTNERS = 'RELATORIOS_MOV_PARCEIROS',
  REPORTS_AUDIT = 'RELATORIOS_AUDITORIA_LOGS',

  // EQUIPE
  TEAM_VIEW = 'EQUIPE_VISUALIZAR',
  TEAM_INVITE = 'EQUIPE_CONVIDAR',
  TEAM_EDIT = 'EQUIPE_EDITAR',
  TEAM_DELETE = 'EQUIPE_EXCLUIR',

  // SUPORTE
  SUPPORT_VIEW = 'SUPORTE_VISUALIZAR',
  SUPPORT_HELP_CHANNELS = 'SUPORTE_CANAIS_AJUDA',
  SUPPORT_SECURITY_BACKUP = 'SUPORTE_SEGURANCA_BACKUP',

  // SAAS (Mantendo compatibilidade básica mas isolado)
  SAAS_DASHBOARD = 'DASHBOARD SAAS MASTER',
  SAAS_COMPANIES = 'GESTÃO DE EMPRESAS',
  SAAS_PLANS = 'GESTÃO DE PLANOS'
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
  createdAt: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
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