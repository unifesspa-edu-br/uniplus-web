import { HttpContext, HttpContextToken } from '@angular/common/http';
import { v7 as uuidv7 } from 'uuid';

/**
 * Token consumido pelo `apiResultInterceptor` (ADR-0011/0014). Quando
 * populado, o interceptor anexa `Idempotency-Key: <value>` ao request.
 *
 * Default `null` — endpoints sem idempotência não são tocados.
 */
export const IDEMPOTENCY_KEY_TOKEN = new HttpContextToken<string | null>(() => null);

/**
 * Limites canônicos do header conforme draft IETF idempotency-key-header-07:
 * 1-255 caracteres ASCII printable (0x20–0x7E), sem `,` (separador de lista
 * HTTP) nem `;` (separador de parâmetro). UUID v7 (36 chars hex+hyphens) sempre
 * passa.
 */
const MIN_KEY_LENGTH = 1;
const MAX_KEY_LENGTH = 255;
const FORBIDDEN_CHAR_CODES = new Set<number>([0x2c, 0x3b]);

/**
 * Gera/expõe a key canônica como UUID v7 (RFC 9562). Encapsulado num objeto
 * para facilitar mock em testes sem stub global.
 */
export const idempotencyKey = {
  /** UUID v7 string opaca: `01910f12-4e6f-7a1b-9c8d-2e9b1d3a0f74`. */
  create(): string {
    return uuidv7();
  },
};

/**
 * Retorna um `HttpContext` com o `IDEMPOTENCY_KEY_TOKEN` populado. Sem
 * argumento, gera UUID v7. Com argumento, valida formato (1-255 ASCII
 * printable, sem `,` nem `;`) e lança `Error` se inválido.
 *
 * Para compor com outros tokens (ex.: vendor MIME), use o método nativo
 * `set(token, value)`:
 *
 * ```ts
 * const ctx = withVendorMime('edital', 1).set(IDEMPOTENCY_KEY_TOKEN, idempotencyKey.create());
 * ```
 */
export function withIdempotencyKey(key?: string): HttpContext {
  const finalKey = key ?? idempotencyKey.create();
  if (!isValidIdempotencyKey(finalKey)) {
    throw new Error(
      `withIdempotencyKey: chave inválida — exige 1-255 caracteres ASCII printable, sem "," nem ";".`,
    );
  }
  return new HttpContext().set(IDEMPOTENCY_KEY_TOKEN, finalKey);
}

/**
 * Códigos que o filtro de idempotência da API emite. Ficam aqui, num ponto só,
 * porque não são erros de nenhum domínio: qualquer tela que envie
 * `Idempotency-Key` pode recebê-los.
 */
export const IDEMPOTENCY_PROBLEM_CODES = {
  /** Mesma chave, corpo diferente — o comando anterior já ocupou a reserva. */
  BODY_MISMATCH: 'uniplus.idempotency.body_mismatch',
  /** Execução anterior ainda em curso; o retry tem de reenviar o mesmo comando. */
  PROCESSING_CONFLICT: 'uniplus.idempotency.processing_conflict',
} as const;

/**
 * Diz se, depois desta falha, o próximo envio precisa de uma `Idempotency-Key`
 * nova.
 *
 * A API guarda a resposta de qualquer status abaixo de 500 associada ao hash do
 * corpo: reenviar o formulário corrigido com a mesma chave devolveria
 * `body_mismatch` em vez de processar o comando novo. As duas exceções são
 * `processing_conflict` — que pede explicitamente retry do **mesmo** comando com
 * a **mesma** chave — e as falhas em que nada foi gravado (5xx, erro de rede),
 * onde repetir a chave é o que torna o retry seguro.
 */
export function deveRotacionarIdempotencyKey(problem: {
  readonly status: number;
  readonly code: string;
}): boolean {
  if (problem.code === IDEMPOTENCY_PROBLEM_CODES.PROCESSING_CONFLICT) {
    return false;
  }
  return problem.status >= 400 && problem.status < 500;
}

/**
 * Type guard exportado para reuso (ex.: validar uma key persistida em
 * sessão). Permite mesmo conjunto de regras do draft IETF.
 */
export function isValidIdempotencyKey(key: string): boolean {
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    return false;
  }
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      return false;
    }
    if (FORBIDDEN_CHAR_CODES.has(code)) {
      return false;
    }
  }
  return true;
}
