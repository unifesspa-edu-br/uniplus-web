import { primeiraDescricao } from './descricao-do-erro';

/**
 * Códigos de erro do fluxo de login, mapeados a partir das respostas
 * OIDC do provedor de identidade. Usado para exibir mensagens contextuais
 * no shell da app quando o provedor redireciona de volta à SPA com erro, e por
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
  OidcProviderUnavailable = 'oidc_provider_unavailable',
  /** Usuário recusou o consentimento ou cancelou o fluxo. */
  AccessDenied = 'access_denied',
  /** Qualquer outro erro não reconhecido. */
  Unknown = 'unknown',
}

export interface LoginErrorDetails {
  code: LoginErrorCode;
  /** Mensagem user-facing em pt-BR. */
  message: string;
  /** Descrição original do provedor OIDC, se disponível (para logs). */
  rawDescription?: string;
}

/** Um tipo de erro de login e as marcas que o identificam na descrição do provedor. */
interface ClassificacaoDoLogin {
  readonly code: LoginErrorCode;
  readonly message: string;
  readonly markers: readonly string[];
}

/** A primeira que casar vence: conta bloqueada antes de credencial inválida. */
const CLASSIFICACOES: readonly ClassificacaoDoLogin[] = [
  {
    code: LoginErrorCode.UserLocked,
    message:
      'Conta temporariamente bloqueada por excesso de tentativas. Aguarde alguns minutos ou use "Esqueci a senha".',
    markers: [
      'account is disabled',
      'account disabled',
      'user is disabled',
      'temporarily locked',
      'temporarily disabled',
      'account is temporarily locked',
      'user is temporarily locked',
      'too many',
    ],
  },
  {
    code: LoginErrorCode.InvalidCredentials,
    message: 'Usuário ou senha inválidos. Confira os dados e tente novamente.',
    markers: [
      'invalid user credentials',
      'invalid credentials',
      'invalid grant',
      'invalid username or password',
    ],
  },
  {
    code: LoginErrorCode.OidcProviderUnavailable,
    message: 'Serviço de autenticação indisponível. Tente novamente em alguns instantes.',
    markers: [
      'failed to fetch',
      'network request failed',
      'unable to connect',
      'service unavailable',
    ],
  },
  {
    code: LoginErrorCode.AccessDenied,
    message: 'Acesso recusado. Você cancelou ou não autorizou o login.',
    markers: ['access_denied'],
  },
];

/**
 * Classifica um erro OIDC em um `LoginErrorCode` + mensagem
 * contextual em pt-BR. Aceita entradas variadas (string de description,
 * objeto com `error_description`, Error genérico).
 */
export function classifyLoginError(input: unknown): LoginErrorDetails {
  const raw = extractDescription(input);
  const normalized = raw.toLowerCase();

  const classificacao = CLASSIFICACOES.find((c) => c.markers.some((m) => normalized.includes(m)));
  if (classificacao) {
    return { code: classificacao.code, message: classificacao.message, rawDescription: raw };
  }

  return erroNaoClassificado(raw);
}

function erroNaoClassificado(raw: string): LoginErrorDetails {
  return {
    code: LoginErrorCode.Unknown,
    message: 'Não foi possível concluir o login. Tente novamente; se persistir, contate o suporte.',
    rawDescription: raw || undefined,
  };
}

const CAMPOS_DA_DESCRICAO = [
  'error_description',
  'errorDescription',
  'description',
  'message',
  'error',
];

function extractDescription(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message ?? '';
  return typeof input === 'object' ? primeiraDescricao(input, CAMPOS_DA_DESCRICAO) : '';
}
