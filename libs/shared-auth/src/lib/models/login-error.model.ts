/**
 * Códigos de erro do fluxo de login, mapeados a partir das respostas
 * OIDC do Keycloak. Usado para exibir mensagens contextuais no shell
 * da app quando o Keycloak redireciona de volta à SPA com erro, e por
 * fluxos customizados (se/quando existirem) que consumam diretamente
 * o resource owner password grant.
 */
export enum LoginErrorCode {
  /** Credenciais inválidas (usuário/senha). */
  InvalidCredentials = 'invalid_credentials',
  /**
   * Conta temporariamente bloqueada por brute force protection
   * (realm com `bruteForceProtected=true` + `failureFactor`).
   */
  UserLocked = 'user_locked',
  /** Provedor de autenticação inacessível. */
  KeycloakUnavailable = 'keycloak_unavailable',
  /** Usuário recusou o consentimento ou cancelou o fluxo. */
  AccessDenied = 'access_denied',
  /** Qualquer outro erro não reconhecido. */
  Unknown = 'unknown',
}

export interface LoginErrorDetails {
  code: LoginErrorCode;
  /** Mensagem user-facing em pt-BR. */
  message: string;
  /** Descrição original do Keycloak, se disponível (para logs). */
  rawDescription?: string;
}

const LOCKED_MARKERS = [
  'account is disabled',
  'account disabled',
  'user is disabled',
  'temporarily locked',
  'temporarily disabled',
  'account is temporarily locked',
  'user is temporarily locked',
  'too many',
];

const INVALID_CREDENTIALS_MARKERS = [
  'invalid user credentials',
  'invalid credentials',
  'invalid grant',
  'invalid username or password',
];

const UNAVAILABLE_MARKERS = [
  'failed to fetch',
  'network request failed',
  'unable to connect',
  'service unavailable',
];

/**
 * Classifica um erro OIDC/Keycloak em um `LoginErrorCode` + mensagem
 * contextual em pt-BR. Aceita entradas variadas (string de description,
 * objeto com `error_description`, Error genérico).
 */
export function classifyLoginError(input: unknown): LoginErrorDetails {
  const raw = extractDescription(input);
  const normalized = raw.toLowerCase();

  if (LOCKED_MARKERS.some((m) => normalized.includes(m))) {
    return {
      code: LoginErrorCode.UserLocked,
      message:
        'Conta temporariamente bloqueada por excesso de tentativas. Aguarde alguns minutos ou use "Esqueci a senha".',
      rawDescription: raw,
    };
  }

  if (INVALID_CREDENTIALS_MARKERS.some((m) => normalized.includes(m))) {
    return {
      code: LoginErrorCode.InvalidCredentials,
      message: 'Usuário ou senha inválidos. Confira os dados e tente novamente.',
      rawDescription: raw,
    };
  }

  if (UNAVAILABLE_MARKERS.some((m) => normalized.includes(m))) {
    return {
      code: LoginErrorCode.KeycloakUnavailable,
      message:
        'Serviço de autenticação indisponível. Tente novamente em alguns instantes.',
      rawDescription: raw,
    };
  }

  if (normalized.includes('access_denied')) {
    return {
      code: LoginErrorCode.AccessDenied,
      message: 'Acesso recusado. Você cancelou ou não autorizou o login.',
      rawDescription: raw,
    };
  }

  return {
    code: LoginErrorCode.Unknown,
    message:
      'Não foi possível concluir o login. Tente novamente; se persistir, contate o suporte.',
    rawDescription: raw || undefined,
  };
}

function extractDescription(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message ?? '';
  if (typeof input !== 'object') return '';

  const candidates: unknown[] = [
    (input as { error_description?: unknown }).error_description,
    (input as { errorDescription?: unknown }).errorDescription,
    (input as { description?: unknown }).description,
    (input as { message?: unknown }).message,
    (input as { error?: unknown }).error,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return '';
}
