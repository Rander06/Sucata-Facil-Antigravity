
import { OperationalProfile, PermissionModule, RemoteAuthorization } from '../types';

export const DEFAULT_PERMISSIONS: Record<OperationalProfile, PermissionModule[]> = {
    [OperationalProfile.VENDEDOR]: [
        PermissionModule.DASHBOARD,
        PermissionModule.SALES_PDV,
        PermissionModule.PARTNERS,
        PermissionModule.STOCK
    ],
    [OperationalProfile.COMPRADOR]: [
        PermissionModule.DASHBOARD,
        PermissionModule.PURCHASES_PDV,
        PermissionModule.PARTNERS,
        PermissionModule.STOCK
    ],
    [OperationalProfile.FINANCEIRO]: [
        PermissionModule.DASHBOARD,
        PermissionModule.FINANCE_LIQUIDATE,
        PermissionModule.FINANCE_AUDIT,
        PermissionModule.FINANCE_EXTRACT,
        PermissionModule.PARTNERS,
        PermissionModule.BANKS,
        PermissionModule.FINANCE_CATEGORIES,
        PermissionModule.COMMERCIAL_TERMS,
        PermissionModule.REPORTS_VIEW,
        PermissionModule.REPORTS_GENERAL,
        PermissionModule.REPORTS_RECEIVABLES,
        PermissionModule.REPORTS_PAYABLES
    ],
    [OperationalProfile.ESTOQUE]: [
        PermissionModule.DASHBOARD,
        PermissionModule.STOCK,
        PermissionModule.REPORTS_VIEW,
        PermissionModule.REPORTS_STOCK
    ],
    [OperationalProfile.GERENTE]: [
        PermissionModule.DASHBOARD,
        PermissionModule.SALES_PDV,
        PermissionModule.PURCHASES_PDV,
        PermissionModule.FINANCE_LIQUIDATE,
        PermissionModule.FINANCE_AUDIT,
        PermissionModule.FINANCE_EXTRACT,
        PermissionModule.STOCK,
        PermissionModule.PARTNERS,
        PermissionModule.TEAMS,
        PermissionModule.BANKS,
        PermissionModule.FINANCE_CATEGORIES,
        PermissionModule.COMMERCIAL_TERMS,
        PermissionModule.REPORTS_VIEW,
        PermissionModule.REPORTS_GENERAL,
        PermissionModule.REPORTS_RECEIVABLES,
        PermissionModule.REPORTS_PAYABLES,
        PermissionModule.REPORTS_STOCK,
        PermissionModule.REPORTS_PARTNERS,
        PermissionModule.REPORTS_AUDIT,
        PermissionModule.SUPPORT_VIEW,
        PermissionModule.SUPPORT_HELP_CHANNELS,
        PermissionModule.SUPPORT_SECURITY_BACKUP
    ],
    [OperationalProfile.MASTER]: Object.values(PermissionModule)
};

export const DEFAULT_AUTHORIZATIONS: Record<OperationalProfile, RemoteAuthorization[]> = {
    [OperationalProfile.VENDEDOR]: [],
    [OperationalProfile.COMPRADOR]: [],
    [OperationalProfile.FINANCEIRO]: [
        RemoteAuthorization.AUTH_FINANCE_TITLE_EDIT,
        RemoteAuthorization.AUTH_FINANCE_TITLE_DELETE,
        RemoteAuthorization.AUTH_FINANCE_TITLE_REVERSE,
        RemoteAuthorization.AUTH_FINANCE_AUDIT_REVERSE,
        RemoteAuthorization.AUTH_FINANCE_EXTRACT_MANUAL_OUT,
        RemoteAuthorization.AUTH_FINANCE_EXTRACT_DELETE,
        RemoteAuthorization.AUTH_FINANCE_EXTRACT_EDIT,
        RemoteAuthorization.AUTH_FINANCE_CLOSE_CASHIER
    ],
    [OperationalProfile.ESTOQUE]: [
        RemoteAuthorization.AUTH_ESTOQUE_EDIT,
        RemoteAuthorization.AUTH_ESTOQUE_DELETE,
        RemoteAuthorization.AUTH_ESTOQUE_ADJUST
    ],
    [OperationalProfile.GERENTE]: [
        RemoteAuthorization.AUTH_ESTOQUE_EDIT,
        RemoteAuthorization.AUTH_ESTOQUE_DELETE,
        RemoteAuthorization.AUTH_ESTOQUE_ADJUST,
        RemoteAuthorization.AUTH_PARTNERS_EDIT,
        RemoteAuthorization.AUTH_PARTNERS_DELETE,
        RemoteAuthorization.AUTH_TEAMS_EDIT,
        RemoteAuthorization.AUTH_TEAMS_DELETE,
        RemoteAuthorization.AUTH_BANKS_EDIT,
        RemoteAuthorization.AUTH_BANKS_DELETE,
        RemoteAuthorization.AUTH_CATEGORIES_EDIT,
        RemoteAuthorization.AUTH_CATEGORIES_DELETE,
        RemoteAuthorization.AUTH_TERMS_EDIT,
        RemoteAuthorization.AUTH_TERMS_DELETE,
        RemoteAuthorization.AUTH_FINANCE_TITLE_EDIT,
        RemoteAuthorization.AUTH_FINANCE_TITLE_DELETE,
        RemoteAuthorization.AUTH_FINANCE_TITLE_REVERSE,
        RemoteAuthorization.AUTH_FINANCE_AUDIT_REVERSE,
        RemoteAuthorization.AUTH_FINANCE_EXTRACT_MANUAL_OUT,
        RemoteAuthorization.AUTH_FINANCE_EXTRACT_DELETE,
        RemoteAuthorization.AUTH_FINANCE_EXTRACT_EDIT,
        RemoteAuthorization.AUTH_FINANCE_CLOSE_CASHIER,
        RemoteAuthorization.AUTH_POS_MANUAL_IN,
        RemoteAuthorization.AUTH_POS_MANUAL_OUT,
        RemoteAuthorization.AUTH_POS_HISTORY_EDIT,
        RemoteAuthorization.AUTH_POS_HISTORY_DELETE,
        RemoteAuthorization.AUTH_POS_HISTORY_REVERSE,
        RemoteAuthorization.AUTH_POS_CLOSE_CASHIER
    ],
    [OperationalProfile.MASTER]: Object.values(RemoteAuthorization)
};
