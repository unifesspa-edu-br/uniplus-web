/**
 * Códigos de status HTTP que o cliente compara para decidir comportamento.
 *
 * A comparação espalhada por número cru (`problem.status === 422`) esconde a
 * intenção no ponto de leitura: quem passa pelo código precisa lembrar o que
 * cada número significa, e uma busca por `422` não distingue a recusa de
 * negócio de um índice qualquer. O catálogo dá nome ao que o contrato REST já
 * define (ADR-0023) e mantém um único lugar para consultar o conjunto que o
 * frontend efetivamente trata.
 *
 * Só entram aqui os status que o cliente examina para tomar decisão. Status
 * devolvidos sem ramificação de comportamento não precisam de nome.
 */
export const STATUS_HTTP = {
  /** Requisição malformada — payload que o servidor não consegue interpretar. */
  REQUISICAO_INVALIDA: 400,
  /** Sem credencial válida: o interceptor de autenticação renova ou encaminha ao login. */
  NAO_AUTENTICADO: 401,
  /** Autenticado, mas sem o papel exigido pela rota. */
  SEM_PERMISSAO: 403,
  /** Recurso inexistente ou fora do alcance de quem consulta. */
  NAO_ENCONTRADO: 404,
  /** Conflito de concorrência ou de estado — costuma pedir recarga antes de repetir. */
  CONFLITO: 409,
  /** Recurso que existiu e foi removido em definitivo. */
  REMOVIDO_EM_DEFINITIVO: 410,
  /** Recusa de regra de negócio: sintaxe válida, conteúdo inaceitável. */
  RECUSA_DE_NEGOCIO: 422,
} as const;

export type StatusHttp = (typeof STATUS_HTTP)[keyof typeof STATUS_HTTP];
