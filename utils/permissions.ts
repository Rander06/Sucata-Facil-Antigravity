
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
        PermissionModule.STOCK,
        PermissionModule.PARTNERS
    ],
    [OperationalProfile.MASTER]: Object.values(PermissionModule).filter(p => ![
        PermissionModule.SAAS_DASHBOARD,
        PermissionModule.SAAS_COMPANIES,
        PermissionModule.SAAS_PLANS,
        PermissionModule.INFRA_CLOUD
    ].includes(p))
};

export const DEFAULT_AUTHORIZATIONS: Record<OperationalProfile, RemoteAuthorization[]> = {
    [OperationalProfile.VENDEDOR]: [],
    [OperationalProfile.COMPRADOR]: [],
    [OperationalProfile.FINANCEIRO]: [],
    [OperationalProfile.ESTOQUE]: [],
    [OperationalProfile.GERENTE]: [],
    [OperationalProfile.MASTER]: Object.values(RemoteAuthorization)
};
