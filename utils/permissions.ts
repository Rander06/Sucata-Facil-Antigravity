
import { OperationalProfile, PermissionModule } from '../types';

export const DEFAULT_PERMISSIONS: Record<OperationalProfile, PermissionModule[]> = {
    [OperationalProfile.VENDEDOR]: [
        PermissionModule.DASHBOARD,
        PermissionModule.SALES_VIEW,
        PermissionModule.SALES_CREATE,
        PermissionModule.PARTNERS_VIEW,
        PermissionModule.PARTNERS_CREATE,
        PermissionModule.STOCK_VIEW
    ],
    [OperationalProfile.COMPRADOR]: [
        PermissionModule.DASHBOARD,
        PermissionModule.PURCHASES_VIEW,
        PermissionModule.PURCHASES_CREATE,
        PermissionModule.PARTNERS_VIEW,
        PermissionModule.PARTNERS_CREATE,
        PermissionModule.STOCK_VIEW
    ],
    [OperationalProfile.FINANCEIRO]: [
        PermissionModule.DASHBOARD,
        PermissionModule.FINANCE_VIEW,
        PermissionModule.FINANCE_CREATE,
        PermissionModule.FINANCE_EDIT,
        PermissionModule.FINANCE_LIQUIDATE,
        PermissionModule.FINANCE_EXTRACT,
        PermissionModule.REPORTS_VIEW,
        PermissionModule.PARTNERS_VIEW
    ],
    [OperationalProfile.ESTOQUE]: [
        PermissionModule.DASHBOARD,
        PermissionModule.STOCK_VIEW,
        PermissionModule.STOCK_CREATE,
        PermissionModule.STOCK_EDIT,
        PermissionModule.STOCK_ADJUST,
        PermissionModule.REPORTS_VIEW
    ],
    [OperationalProfile.GERENTE]: [
        // Dashboard e Módulos Gerais
        PermissionModule.DASHBOARD,
        PermissionModule.REPORTS_VIEW,
        PermissionModule.TEAM_VIEW,
        PermissionModule.TEAM_INVITE,
        PermissionModule.SUPPORT_VIEW,

        // Financeiro
        PermissionModule.FINANCE_VIEW,
        PermissionModule.FINANCE_CREATE,
        PermissionModule.FINANCE_EDIT,
        PermissionModule.FINANCE_DELETE,
        PermissionModule.FINANCE_LIQUIDATE,
        PermissionModule.FINANCE_EXTRACT,

        // Compras
        PermissionModule.PURCHASES_VIEW,
        PermissionModule.PURCHASES_CREATE,
        PermissionModule.PURCHASES_EDIT,
        PermissionModule.PURCHASES_DELETE,

        // Vendas
        PermissionModule.SALES_VIEW,
        PermissionModule.SALES_CREATE,
        PermissionModule.SALES_CLOSE_CASHIER,

        // Estoque
        PermissionModule.STOCK_VIEW,
        PermissionModule.STOCK_CREATE,
        PermissionModule.STOCK_EDIT,
        PermissionModule.STOCK_DELETE,
        PermissionModule.STOCK_ADJUST,

        // Parceiros
        PermissionModule.PARTNERS_VIEW,
        PermissionModule.PARTNERS_CREATE,
        PermissionModule.PARTNERS_EDIT,
        PermissionModule.PARTNERS_DELETE,

        // Equipe
        PermissionModule.TEAM_EDIT,
        PermissionModule.TEAM_DELETE
    ],
    [OperationalProfile.MASTER]: Object.values(PermissionModule)
};
