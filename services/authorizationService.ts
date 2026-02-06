import { db } from './dbService';
import { AuthorizationRequest, User } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Auxiliar para gerar códigos curtos legíveis
 */
const generateFriendlyCode = (prefix: string) => {
  return `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

/**
 * SERVIÇO DE AUTORIZAÇÃO CONTROLADA
 * Este serviço gerencia pedidos de liberação para ações sensíveis.
 */
export const authorizationService = {

  /**
   * Registra um novo pedido de liberação no sistema
   */
  requestAuthorization: async (
    actionKey: string,
    actionLabel: string,
    user: User
  ): Promise<AuthorizationRequest> => {
    const companyId = user.companyId || user.company_id || '';
    const protocolCode = generateFriendlyCode('REQ');

    const newRequest: Partial<AuthorizationRequest> = {
      company_id: companyId,
      action_key: actionKey,
      action_label: actionLabel,
      action_payload: "", // @google/genai Senior Frontend Engineer: FIX PARA CONSTRAINT NOT NULL
      requested_by_id: user.id,
      requested_by_name: user.name,
      protocol_id: protocolCode,
      status: 'PENDING',
      created_at: db.getNowISO()
    };

    const savedRequest = await db.insert<AuthorizationRequest>('authorization_requests' as any, newRequest);

    // Log obrigatório para o histórico de auditoria
    await db.logAction(
      companyId,
      user.id,
      user.name,
      'AUTH_REQUEST_CREATED',
      `(PEDIDO ${protocolCode}) - SOLICITAÇÃO DE LIBERAÇÃO PARA AÇÃO: ${actionLabel.toUpperCase()}`
    );

    return savedRequest;
  },

  /**
   * Retorna pedidos pendentes e aprovados (para processamento) da empresa
   */
  getPendingAuthorizations: (companyId: string | null): AuthorizationRequest[] => {
    return db.queryTenant<AuthorizationRequest>(
      'authorization_requests' as any,
      companyId,
      (req) => req.status === 'PENDING' || req.status === 'APPROVED' || req.status === 'DENIED'
    );
  },

  /**
   * Aprova uma solicitação de liberação
   */
  approveAuthorization: async (
    requestId: string,
    approver: User
  ): Promise<AuthorizationRequest> => {
    const companyId = approver.companyId || approver.company_id || '';
    const approvalCode = generateFriendlyCode('APR');

    const updated = await db.update<AuthorizationRequest>('authorization_requests' as any, requestId, {
      status: 'APPROVED',
      approval_code: approvalCode,
      responded_at: db.getNowISO(),
      responded_by_id: approver.id,
      responded_by_name: approver.name
    });

    // Log obrigatório para o histórico de auditoria
    await db.logAction(
      companyId,
      approver.id,
      approver.name,
      'AUTH_REQUEST_APPROVED',
      `[(APROVAÇÃO ${approvalCode})] CONCEDIDA PARA O (PEDIDO ${updated.protocol_id}). OPERAÇÃO LIBERADA PELO GESTOR ${approver.name.toUpperCase()}`
    );

    return updated;
  },

  /**
   * Nega uma solicitação de liberação
   */
  denyAuthorization: async (
    requestId: string,
    denier: User
  ): Promise<AuthorizationRequest> => {
    const companyId = denier.companyId || denier.company_id || '';

    const updated = await db.update<AuthorizationRequest>('authorization_requests' as any, requestId, {
      status: 'DENIED',
      responded_at: db.getNowISO(),
      responded_by_id: denier.id,
      responded_by_name: denier.name
    });


    await db.logAction(
      companyId,
      denier.id,
      denier.name,
      'AUTH_REQUEST_DENIED',
      `LIBERAÇÃO NEGADA PELO GESTOR PARA O (PEDIDO ${updated.protocol_id})`
    );

    return updated;
  },

  /**
   * Verifica o status de um pedido específico
   */
  checkRequestStatus: (requestId: string): AuthorizationRequest | null => {
    const results = db.query<AuthorizationRequest>('authorization_requests' as any, (r) => r.id === requestId);
    return results.length > 0 ? results[0] : null;
  }
};